import { Hunk } from '../../model/domain.ts';
import { Rpi } from '../../model/rpi';
import {
    AgentClosedReason,
    AgentEvent,
    AgentSession,
    AgentSocket,
    AgentStopReason,
} from '../../model/rpi/agentSocket.ts';
import {
    Events,
    ObserverService,
    States,
} from '../../model/service/ObserverService.ts';
import { EditorNavigationTarget, ViewModelRepository } from '../repository';
import { IdeService } from '../domain/IdeService.ts';
import { LoaderService } from '../domain/LoaderService.ts';
import { AgentEventService } from '../domain/AgentEventService.ts';
import { EditingLockService } from '../domain/EditingLockService.ts';
import { HunkService } from './HunkService.ts';
import { TextFileEditorService } from './TextFileEditorService.ts';
import { ProgramEditorService } from './ProgramEditorService.ts';
import { TokenPageService } from './TokenPageService.ts';
import {
    reportToSentry,
    reportUnexpectedError,
} from '../utils/reportUnexpectedError.ts';
import { logBreadcrumb } from '../utils/logBreadcrumb.ts';
import { compileErrorsPrompt } from '../utils/compileErrors.ts';
import { trackEvent } from '../utils/observerContext.ts';

/** Причины, при которых показываем ошибку, а не ответ. */
const ERROR_STOP_REASONS: AgentStopReason[] = [
    'PaymentRequired',
    'Locked',
    'UnauthorizedLimitExceeded',
    // запрос отклонён до запуска, применять нечего
    'PromptTooLong',
    'UnknownError',
];

/** Причины, при которых агент не доработал, но изменения всё равно применились. */
const PARTIAL_STOP_REASONS: AgentStopReason[] = [
    'IterationLimit',
    'ContextOverflow',
    'Timeout',
    // отказ пришёл на одном шаге, а сделанное до него уже в проекте
    'QuotaExceeded',
];

export class AgentChatService {
    private session: AgentSession | null = null;
    private knownHunks: Hunk[] = [];
    /** Hunks на старте прогона: база для итогового списка изменений при прерывании */
    private runStartHunks: Hunk[] = [];
    /**
     * Прогон кончился сам: пришёл финал или оборвался сокет. Пока внутри идёт
     * сверка программы, состояние ещё 'running' и кнопка прерывания на экране,
     * но прерывать уже нечего, а разбор конца прогона обрывать нельзя
     */
    private runEnded = false;
    /** Прерывание уже идёт: кнопка висит до конца досинхронизации, второй клик не в счёт */
    private aborting = false;
    /** Сокет открыт. Сессию гасят и финал, и обрыв, поэтому о запуске по ней не судим */
    private runStarted = false;
    /**
     * Номер текущего прогона. Растёт на каждом запуске и на каждом закрытии,
     * поэтому всё, что успело уйти в сеть от прошлого прогона, узнаёт себя
     * по устаревшему номеру и молча выходит вместо записи в чужую ленту.
     */
    private runToken = 0;
    /** Последнее место, которое агент правил в текущем прогоне */
    private lastChange: EditorNavigationTarget | undefined;
    /** Перечитать программу не вышло или сокет оборвался: в редакторе может быть старая программа */
    private programMayBeStale = false;
    /** Текст последнего запроса: слишком длинный вернём в поле, чтобы его сократили */
    private lastPrompt = '';

    constructor(
        private repository: ViewModelRepository,
        private rpi: Rpi,
        private agentSocket: AgentSocket,
        private ideService: IdeService,
        private loaderService: LoaderService,
        private hunkService: HunkService,
        private textFileEditorService: TextFileEditorService,
        private programEditorService: ProgramEditorService,
        private tokenPageService: TokenPageService,
        private observerService: ObserverService,
        private editingLock: EditingLockService,
        private events: AgentEventService = new AgentEventService()
    ) {}

    private track(event: string, properties?: Record<string, unknown>) {
        trackEvent(this.observerService, this.repository, event, properties);
    }

    /**
     * Гостю показываем окно входа вместо самого действия. Метод не предикат:
     * он шлёт событие и открывает окно, source это место в интерфейсе, откуда
     * пришёл клик. Возвращает true, когда действие можно выполнять как обычно
     */
    private openLoginIfGuest = (source: string): boolean => {
        if (this.repository.userViewModelRepository.isAuthenticated()) {
            return true;
        }
        this.track(Events.EVENT_AUTH_MODAL_OPENED, { source });
        this.repository.authViewModelRepository.setCurrentView('login');
        return false;
    };

    private agentSettings() {
        return {
            max_tokens:
                this.repository.persistenceViewModelRepository.agentMaxTokens(),
            iterations:
                this.repository.persistenceViewModelRepository.agentIterations(),
            authorized:
                this.repository.userViewModelRepository.isAuthenticated(),
        };
    }

    isRunning = (): boolean => {
        const state = this.repository.chatViewModelRepository.requestState();
        return state === 'connecting' || state === 'running';
    };

    /** Пользователь попробовал что-то поменять, пока агент работает. */
    onBlockedEditAttempt = (): void => {
        this.track(Events.EVENT_EDIT_BLOCKED, { action: 'edit' });
        this.editingLock.rejectEdit();
    };

    onInputChanged = (text: string): void => {
        this.repository.chatViewModelRepository.setInput(text);
    };

    onMaxTokensChanged = (value: number): void => {
        // клик гостя проглатываем целиком, иначе в аналитику уйдёт изменение, которого не было
        if (!this.openLoginIfGuest('agent_settings')) {
            return;
        }
        this.repository.persistenceViewModelRepository.setAgentMaxTokens(value);
        this.track(Events.EVENT_AGENT_SETTINGS_CHANGED, {
            setting: 'max_tokens',
            value,
        });
    };

    onIterationsChanged = (value: number): void => {
        if (!this.openLoginIfGuest('agent_settings')) {
            return;
        }
        this.repository.persistenceViewModelRepository.setAgentIterations(
            value
        );
        this.track(Events.EVENT_AGENT_SETTINGS_CHANGED, {
            setting: 'iterations',
            value,
        });
    };

    /** Вкладка открыта: у авторизованного один раз подтягиваем историю. */
    onChatOpened = async (): Promise<void> => {
        const chat = this.repository.chatViewModelRepository;
        if (!this.repository.userViewModelRepository.isAuthenticated()) {
            return;
        }
        if (chat.historyRequestState() !== 'unknown') {
            return;
        }
        await this.loadHistory();
    };

    loadHistory = async (): Promise<void> => {
        const chat = this.repository.chatViewModelRepository;
        const project = this.repository.projectViewModelRepository.project();
        if (!project) {
            return;
        }
        chat.setHistoryRequestState('loading');
        const result = await this.rpi.getAgentHistoryRequest(project.projectId);
        if (!result.isOk) {
            chat.setHistoryRequestState('error');
            return;
        }
        chat.setHistory(result.body.history ?? []);
        chat.setHistoryRequestState('ok');
    };

    onClearHistoryClicked = async (): Promise<void> => {
        const chat = this.repository.chatViewModelRepository;
        const project = this.repository.projectViewModelRepository.project();
        if (
            !project ||
            !this.repository.userViewModelRepository.isAuthenticated()
        ) {
            return;
        }
        const result = await this.rpi.clearAgentHistoryRequest(
            project.projectId
        );
        if (!result.isOk) {
            // не чистим локально до подтверждения, иначе история «исчезнет» и вернётся после F5
            chat.setHistoryRequestState('error');
            this.repository.toast(
                this.repository.dictionary.agent_chat.history_clear_error,
                'error'
            );
            return;
        }
        this.track(Events.EVENT_CHAT_HISTORY_CLEARED);
        chat.setHistory([]);
        chat.setMessages([]);
        chat.setHistoryRequestState('ok');
    };

    /**
     * Согласие на трансграничную передачу. У вошедшего источник истины на
     * сервере, у гостя серверу записать его некуда, поэтому отметка в локальном
     * хранилище считается наравне: один раз согласился, второй раз не спрашиваем
     */
    private crossBorderConsentGiven = (): boolean => {
        const user = this.repository.userViewModelRepository;
        if (
            user.isAuthenticated() &&
            user.crossBorderDataTransferPolicyAccepted()
        ) {
            return true;
        }
        return this.repository.persistenceViewModelRepository.crossBorderConsentAcceptedLocally();
    };

    /**
     * Человек отметил согласие в плашке. Запрос, из-за которого её показали,
     * уходит сам: текст всё это время лежал в поле ввода нетронутым
     */
    onCrossBorderConsentAccepted = async (): Promise<void> => {
        this.repository.persistenceViewModelRepository.setCrossBorderConsentAcceptedLocally(
            true
        );
        this.repository.settingsViewModelRepository.setShowCrossBorderConsentModal(
            false
        );

        this.track(Events.EVENT_CROSS_BORDER_CONSENT_ACCEPTED);
        if (this.repository.userViewModelRepository.isAuthenticated()) {
            await this.sendCrossBorderConsent();
        }

        await this.onPromptSubmit('consent_resume');
    };

    onCrossBorderConsentDismissed = (): void => {
        this.track(Events.EVENT_CROSS_BORDER_CONSENT_DISMISSED);
        this.repository.settingsViewModelRepository.setShowCrossBorderConsentModal(
            false
        );
    };

    /**
     * Отправляет согласие на сервер. Не доехало — молчим: локальная отметка
     * осталась, досылка повторится при следующем запуске, и держать человека
     * из-за неудачной записи не за что
     */
    sendCrossBorderConsent = async (): Promise<void> => {
        const response =
            await this.rpi.acceptCrossBorderDataTransferPolicyRequest();
        if (!response.isOk) {
            logBreadcrumb(
                'agent',
                'cross_border_consent_not_saved',
                { code: response.code },
                'warning'
            );
        }
    };

    /**
     * Кнопка в панели ошибок. Только подставляет текст и открывает чат,
     * отправляет человек сам: так он видит, что уйдёт агенту
     */
    onSendErrorsToAgent = (): void => {
        const errors =
            this.repository.projectViewModelRepository.compileErrorResult()
                ?.errors;
        // у чужого проекта чата нет, кнопку там не показываем
        if (
            !errors?.length ||
            this.repository.projectViewModelRepository.projectIsReadonly()
        ) {
            return;
        }
        const chat = this.repository.chatViewModelRepository;
        const dictionary = this.repository.dictionary.agent_chat;
        if (this.isRunning()) {
            this.repository.toast(dictionary.errors_agent_running, 'info');
            return;
        }
        // чужой недописанный запрос не затираем
        if (chat.input().trim()) {
            this.repository.toast(dictionary.errors_prompt_busy, 'info');
            return;
        }
        this.track(Events.EVENT_SEND_ERRORS_TO_AGENT, {
            error_count: errors.length,
        });
        chat.setInput(compileErrorsPrompt(errors, this.repository.dictionary));
        const settings = this.repository.settingsViewModelRepository;
        settings.setViewerTab('chat');
        // на телефоне чат это отдельный экран
        settings.setMobileView('chat');
    };

    onPromptSubmit = async (
        source: 'chat' | 'consent_resume' = 'chat'
    ): Promise<void> => {
        const chat = this.repository.chatViewModelRepository;
        const prompt = chat.input().trim();
        if (!prompt || this.isRunning()) {
            return;
        }
        const project = this.repository.projectViewModelRepository.project();
        const authenticated =
            this.repository.userViewModelRepository.isAuthenticated();
        // авторизованному без проекта отправлять некуда, до ленты дело не доводим
        if (authenticated && !project) {
            return;
        }
        // до согласия запрос никуда не идёт: ни поле не чистим, ни ленту не трогаем,
        // чтобы после принятия отправить ровно то же самое
        if (!this.crossBorderConsentGiven()) {
            this.track(Events.EVENT_CROSS_BORDER_CONSENT_SHOWN);
            this.repository.settingsViewModelRepository.setShowCrossBorderConsentModal(
                true
            );
            return;
        }

        // слот занимается до первого await, иначе второе нажатие проскочит проверку
        const token = ++this.runToken;
        this.lastChange = undefined;
        this.runEnded = false;
        this.runStarted = false;
        this.track(Events.EVENT_AGENT_PROMPT_SUBMITTED, {
            ...this.agentSettings(),
            prompt_length: prompt.length,
            source,
        });
        logBreadcrumb('agent', 'prompt submit', {
            authenticated,
            hasProject: Boolean(project),
        });
        chat.setRequestState('connecting');
        this.lastPrompt = prompt;
        chat.setInput('');
        chat.appendMessage({
            kind: 'request',
            text: prompt,
            createdAt: new Date().toISOString(),
        });

        // старую программу нельзя сохранять перед запуском: она затрёт правку прошлого прогона
        const synced = await this.resyncProgram(token);
        const saved = synced && (await this.flushPendingSaves());
        // за время сохранения могли уйти со страницы или открыть другой проект
        if (token !== this.runToken) {
            return;
        }
        if (!synced) {
            logBreadcrumb('agent', 'sync_failed', undefined, 'warning');
            this.track(Events.EVENT_AGENT_FAILED, { reason: 'sync_failed' });
            chat.appendMessage({ kind: 'error', reason: 'sync_failed' });
            chat.setRequestState('error');
            return;
        }
        if (!saved) {
            // агент работает с тем, что лежит на сервере, а там осталась прошлая версия
            logBreadcrumb('agent', 'save_failed', undefined, 'warning');
            this.track(Events.EVENT_AGENT_FAILED, { reason: 'save_failed' });
            chat.appendMessage({ kind: 'error', reason: 'save_failed' });
            chat.setRequestState('error');
            return;
        }

        this.knownHunks = this.repository.ideViewModelRepository.hunks();
        // knownHunks перезаписывается на каждом toolCall, для итога нужен снимок всего прогона
        this.runStartHunks = this.knownHunks;
        this.track(Events.EVENT_AGENT_STARTED, this.agentSettings());

        const params = {
            prompt,
            numberIterations:
                this.repository.persistenceViewModelRepository.agentIterations(),
            maxTokens:
                this.repository.persistenceViewModelRepository.agentMaxTokens(),
        };
        const handlers = {
            onEvent: (event: AgentEvent) => this.onAgentEvent(token, event),
            onClosed: (reason: AgentClosedReason) =>
                void this.onAgentClosed(token, reason),
        };

        if (authenticated && project) {
            this.session = this.agentSocket.startAgent(
                project.projectId,
                params,
                handlers
            );
            this.runStarted = true;
            return;
        }

        this.session = this.agentSocket.startAgentUnauthorized(
            {
                ...params,
                program:
                    this.repository.projectViewModelRepository.currentProgram(),
            },
            handlers
        );
        this.runStarted = true;
    };

    /**
     * Кнопка прерывания. Кадра отмены в протоколе нет, поэтому единственный рычаг
     * это закрыть сокет: сервер про остановку не узнает, и сделанное остаётся в проекте
     */
    onAbortClicked = async (): Promise<void> => {
        if (!this.isRunning()) {
            return;
        }
        // прогон кончился сам: ответ модели оплачен, а сообщение об обрыве обязано дойти
        if (this.runEnded) {
            return;
        }
        // первое прерывание ещё идёт, и второй клик написал бы в ленту свой итог
        if (this.aborting) {
            return;
        }
        this.aborting = true;
        try {
            await this.abortRun();
        } finally {
            this.aborting = false;
        }
    };

    private abortRun = async (): Promise<void> => {
        const chat = this.repository.chatViewModelRepository;
        const authenticated =
            this.repository.userViewModelRepository.isAuthenticated();
        // до открытия сокета останавливать нечего: сверка и сохранение идут сами по себе
        const started = this.runStarted;
        logBreadcrumb('agent', 'abort', { authenticated, started });
        this.track(Events.EVENT_AGENT_ABORTED, {
            ...this.agentSettings(),
            started,
        });
        // номер занимаем до закрытия: всё, что висит в очереди событий, узнает себя по старому
        const token = ++this.runToken;
        this.session?.close();
        this.session = null;

        if (!started) {
            // запуск не состоялся, менять на сервере было нечему
            chat.appendMessage({ kind: 'notice', reason: 'aborted_nothing' });
            chat.setRequestState('idle');
            return;
        }
        if (!authenticated) {
            // гостю правки приезжают одним куском в финале, а финала уже не будет
            chat.appendMessage({ kind: 'notice', reason: 'aborted_guest' });
            chat.setRequestState('idle');
            return;
        }

        const synced = await this.syncAfterAbort(token);
        if (token !== this.runToken) {
            return;
        }
        if (!synced) {
            // список собирать не из чего: молча показать старый значит соврать
            chat.appendMessage({ kind: 'notice', reason: 'aborted_unsynced' });
            chat.setRequestState('idle');
            return;
        }
        const changes = this.events.describeChanges(
            this.events.changedHunks(
                this.runStartHunks,
                this.repository.ideViewModelRepository.hunks()
            )
        );
        chat.appendMessage(
            changes.length
                ? { kind: 'notice', reason: 'aborted', changes }
                : { kind: 'notice', reason: 'aborted_nothing' }
        );
        chat.setRequestState('idle');
    };

    /** Смена проекта: гасим сессию и чистим ленту, чтобы не показывать чужую историю. */
    onProjectChanged = (): void => {
        this.closeSession();
        const chat = this.repository.chatViewModelRepository;
        // вход гостя открывает проект заново, и набранный им запрос обязан это пережить
        const typed = chat.input();
        chat.reset();
        chat.setInput(typed);
    };

    /** Соединение живёт, пока открыт проект. Закрываем при смене проекта и уходе. */
    closeSession = (): void => {
        this.runToken += 1;
        // программа другого проекта загрузится заново
        this.programMayBeStale = false;
        this.session?.close();
        this.session = null;
        if (this.isRunning()) {
            this.repository.chatViewModelRepository.setRequestState('idle');
        }
    };

    /**
     * Сервер не принимает изменения проекта, пока работает агент, поэтому всё
     * висящее надо дописать до старта. Возвращает false, если дописать не вышло:
     * запускать агента поверх несохранённой правки нельзя, он её не увидит.
     */
    private flushPendingSaves = async (): Promise<boolean> => {
        const ide = this.repository.ideViewModelRepository;
        const canSave =
            Boolean(this.repository.projectViewModelRepository.project()) &&
            this.repository.userViewModelRepository.isAuthenticated() &&
            !this.repository.projectViewModelRepository.projectIsReadonly();

        if (ide.activeTextFile()) {
            const savedFile =
                await this.textFileEditorService.flushAndStopAutosave();
            if (canSave && !savedFile) {
                return false;
            }
        }
        if (!canSave) {
            // неавторизованному и на чужом проекте сохранять нечего и некуда
            return true;
        }
        await this.loaderService.segmentEditorSaveProgram();
        return ide.saveProjectRequestState() !== 'error';
    };

    private onAgentEvent = async (
        token: number,
        event: AgentEvent
    ): Promise<void> => {
        if (token !== this.runToken) {
            return;
        }
        try {
            await this.handleAgentEvent(token, event);
        } catch (error) {
            // иначе отказ внутри обработки оставит чат навсегда в состоянии загрузки
            reportUnexpectedError(
                this.observerService,
                'agent.event_handler',
                error
            );
            await this.onAgentClosed(token, 'closed', true);
        }
    };

    private handleAgentEvent = async (
        token: number,
        event: AgentEvent
    ): Promise<void> => {
        const chat = this.repository.chatViewModelRepository;
        if (event.kind !== 'finished') {
            chat.setRequestState('running');
        }

        if (event.kind === 'modelFinished') {
            chat.appendMessage(this.events.describeModelCall());
            if (this.repository.userViewModelRepository.isAuthenticated()) {
                try {
                    await this.tokenPageService.refreshUserInfo();
                } catch (error) {
                    // баланс это справка сбоку, его отказ не должен ронять прогон
                    console.error(error);
                }
            }
            return;
        }

        if (event.kind === 'toolCall') {
            await this.onToolCall(token, event.toolName);
            return;
        }

        await this.onFinished(token, event);
    };

    private onToolCall = async (
        token: number,
        toolName: Parameters<AgentEventService['describeToolCall']>[0]
    ): Promise<void> => {
        const chat = this.repository.chatViewModelRepository;
        if (!this.repository.userViewModelRepository.isAuthenticated()) {
            // неавторизованному hunks приезжают одним куском в финале,
            // поэтому строка пишется без файла и номера сегмента
            for (const draft of this.events.describeToolCall(toolName, [])) {
                chat.appendMessage(draft);
            }
            return;
        }

        // под замком ревизия стоит, а после обрыва замок снимается раньше, чем доедет ответ
        const revision =
            this.repository.ideViewModelRepository.programChangeRevision();
        await this.hunkService.loadHunks();
        // hunks ехали из сети, за это время проект мог смениться
        if (token !== this.runToken) {
            return;
        }
        const hunks = this.repository.ideViewModelRepository.hunks();
        const fresh = this.events.changedHunks(this.knownHunks, hunks);
        this.knownHunks = hunks;

        for (const draft of this.events.describeToolCall(toolName, fresh)) {
            chat.appendMessage(draft);
        }

        const scope = this.events.reloadScope(toolName, fresh);
        if (scope.program) {
            await this.reloadProgram(token, revision);
        }
        if (scope.files) {
            const project =
                this.repository.projectViewModelRepository.project();
            if (project) {
                await this.loaderService.loadFiles(project.projectId);
            }
        }
        // пока ехали программа и файлы, человек мог уйти в другой проект
        if (token !== this.runToken) {
            return;
        }
        // незнакомый инструмент мог удалить или переименовать открытый файл
        this.textFileEditorService.closeActiveTextFileIfGone();

        this.lastChange =
            this.events.lastNavigationTarget(fresh) ?? this.lastChange;
        const target = this.events.firstNavigationTarget(fresh);
        if (target) {
            await this.programEditorService.navigateToAgentChange(target);
        }
    };

    /** На телефоне чат и редактор разные экраны: после прогона ведём туда, где агент правил последним */
    onAgentFinishedOnPhone = async (): Promise<void> => {
        const target = this.lastChange;
        // без правок и после ошибки человеку нужен чат: там ответ или текст ошибки
        if (
            !target ||
            this.repository.chatViewModelRepository.requestState() !== 'ok'
        ) {
            return;
        }
        this.repository.settingsViewModelRepository.setMobileView('editor');
        await this.programEditorService.navigateToAgentChange(target);
    };

    private onFinished = async (
        token: number,
        event: Extract<AgentEvent, { kind: 'finished' }>
    ): Promise<void> => {
        const chat = this.repository.chatViewModelRepository;
        this.session = null;
        this.runEnded = true;
        this.observerService.setUserState(
            States.STATE_AGENT_STOP_REASON,
            event.stopReason
        );
        const isError = ERROR_STOP_REASONS.includes(event.stopReason);

        // сервер шлёт program при любом stopReason, но при отказе применять её нельзя:
        // при UnauthorizedLimitExceeded прогона не было, и подменять программу нечем
        if (event.program && !isError) {
            this.applyUnauthorizedResult(event.program, event.hunks ?? []);
        }
        // замок снимаем после сверки, иначе правка человека ляжет на старую программу
        await this.resyncProgram(token);
        if (token !== this.runToken) {
            return;
        }

        if (isError) {
            chat.appendMessage({ kind: 'error', reason: event.stopReason });
            // длинный запрос возвращаем, чтобы было что сокращать, а гостю возвращаем любой:
            // под ошибкой ему предлагают войти, а вход оставляет от ленты только поле ввода
            const returnPrompt =
                event.stopReason === 'PromptTooLong' ||
                !this.repository.userViewModelRepository.isAuthenticated();
            if (returnPrompt && !chat.input()) {
                chat.setInput(this.lastPrompt);
            }
            chat.setRequestState('error');
            this.reportStopReason(event.stopReason);
            return;
        }

        if (event.message) {
            chat.appendMessage({ kind: 'response', text: event.message });
        }
        if (PARTIAL_STOP_REASONS.includes(event.stopReason)) {
            // прогон не доработал, но изменения применились: это оговорка, а не отказ
            chat.appendMessage({ kind: 'notice', reason: event.stopReason });
        }
        chat.setRequestState('ok');
        this.track(Events.EVENT_AGENT_FINISHED, {
            ...this.agentSettings(),
            stop_reason: event.stopReason,
            hunk_count: event.hunks?.length ?? this.knownHunks.length,
        });
    };

    private applyUnauthorizedResult = (
        program: Parameters<IdeService['replaceProgram']>[0],
        hunks: Hunk[]
    ): void => {
        // у неавторизованного откат делается только через undo, поэтому replaceProgram
        this.ideService.replaceProgram(program);
        this.hunkService.setHunksFromPrompt(hunks);
        this.lastChange = this.events.lastNavigationTarget(hunks);
        const target = this.events.firstNavigationTarget(hunks);
        if (target) {
            void this.programEditorService.navigateToAgentChange(target);
        }
    };

    /**
     * true, если программа перечитана. editedAfter: ревизия, после которой
     * правки человека важнее ответа сервера
     */
    private reloadProgram = async (
        token: number,
        editedAfter?: number
    ): Promise<boolean> => {
        const project = this.repository.projectViewModelRepository.project();
        if (!project) {
            return false;
        }
        const result = await this.rpi.getProjectRequest(project.projectId);
        // ответ по проекту, из которого уже ушли, в открытый проект не пишем
        if (token !== this.runToken) {
            return false;
        }
        if (!result.isOk) {
            this.programMayBeStale = true;
            return false;
        }
        if (
            editedAfter !== undefined &&
            editedAfter !==
                this.repository.ideViewModelRepository.programChangeRevision()
        ) {
            return false;
        }
        // setNewProgram, а не replaceProgram: двадцать итераций дадут двадцать точек отмены
        this.ideService.setNewProgram(
            result.body.program,
            result.body.lastProgramResult
        );
        this.programMayBeStale = false;
        await this.textFileEditorService.reloadActiveTextFileIfOpen();
        return true;
    };

    /**
     * Досинхронизация после прерывания. Правка последнего инструмента могла не
     * доехать, поэтому перечитываем безусловно, а порядок берём как в resyncProgram:
     * программа перекладывает под себя hunks, поэтому она первая
     */
    private syncAfterAbort = async (token: number): Promise<boolean> => {
        try {
            if (!(await this.reloadProgram(token))) {
                // без проекта флаг не выставлен, а следующий запуск обязан свериться
                this.programMayBeStale = true;
                return false;
            }
            const loaded = await this.hunkService.loadHunks();
            if (!loaded) {
                // список правок остался неизвестным, а снимок прогона берут с него
                this.programMayBeStale = true;
            }
            return loaded;
        } catch (error) {
            reportUnexpectedError(
                this.observerService,
                'agent.abort_resync',
                error
            );
            this.programMayBeStale = true;
            return false;
        }
    };

    /** false, если программа может расходиться с сервером. Зовётся под замком */
    private resyncProgram = async (token: number): Promise<boolean> => {
        if (!this.programMayBeStale) {
            return true;
        }
        let synced = false;
        try {
            synced = await this.reloadProgram(token);
            if (synced) {
                await this.hunkService.loadHunks();
            }
        } catch (error) {
            reportUnexpectedError(this.observerService, 'agent.resync', error);
        }
        return synced;
    };

    private reportStopReason = (reason: AgentStopReason): void => {
        logBreadcrumb('agent', `stop ${reason}`, { reason });
        this.track(Events.EVENT_AGENT_FAILED, { reason });
        if (reason === 'PaymentRequired') {
            this.track(Events.EVENT_PAYMENT_REQUIRED, { source: 'agent' });
            return;
        }
        if (reason === 'UnauthorizedLimitExceeded') {
            // вошедшему окно входа не поможет, а раз лимит для незарегистрированных
            // ему всё-таки прислали, контракт нарушен и это надо увидеть
            if (this.openLoginIfGuest('agent_limit')) {
                reportUnexpectedError(
                    this.observerService,
                    `agent.stop.${reason}`,
                    new Error(`Agent stop reason ${reason} for authorized user`)
                );
            }
            return;
        }
        if (reason === 'Locked') {
            // замок пришёл кадром сокета, а не кодом 423, поэтому WebRpi его не видит
            this.track(Events.EVENT_PROJECT_LOCKED, {
                source: 'agent',
                operation: 'agent_run',
                expected: true,
            });
        }
        if (reason === 'UnknownError' || reason === 'Locked') {
            reportUnexpectedError(
                this.observerService,
                `agent.stop.${reason}`,
                new Error(`Agent stop reason ${reason}`)
            );
        }
    };

    private onAgentClosed = async (
        token: number,
        reason: AgentClosedReason,
        alreadyReported = false
    ): Promise<void> => {
        if (token !== this.runToken) {
            return;
        }
        this.session = null;
        // до первого await: пока разбирается обрыв, прерывать уже нечего
        this.runEnded = true;
        logBreadcrumb(
            'agent',
            `chat closed ${reason}`,
            { reason, alreadyReported },
            reason === 'timeout' ? 'warning' : 'error'
        );
        if (!alreadyReported) {
            this.reportClosed(reason);
        }
        // после обрыва очередь событий выбрасывается, и правка агента могла остаться в ней
        if (
            reason !== 'connect_failed' &&
            this.repository.userViewModelRepository.isAuthenticated()
        ) {
            this.programMayBeStale = true;
        }
        await this.resyncProgram(token);
        if (token !== this.runToken) {
            return;
        }
        const chat = this.repository.chatViewModelRepository;
        chat.appendMessage({
            kind: 'error',
            reason: reason === 'closed' ? 'disconnected' : reason,
        });
        chat.setRequestState('error');
    };

    private reportClosed = (reason: AgentClosedReason): void => {
        if (reason === 'timeout') {
            this.track(Events.EVENT_AGENT_TIMEOUT);
            reportToSentry('agent.timeout', new Error('Agent socket timeout'));
            return;
        }
        this.track(Events.EVENT_AGENT_FAILED, { reason });
        reportUnexpectedError(
            this.observerService,
            `agent.${reason === 'closed' ? 'disconnected' : reason}`,
            new Error(`Agent socket ${reason}`)
        );
    };
}
