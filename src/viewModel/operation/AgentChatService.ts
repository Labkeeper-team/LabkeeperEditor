import { Hunk } from '../../model/domain.ts';
import { Rpi } from '../../model/rpi';
import {
    AgentClosedReason,
    AgentEvent,
    AgentRunMode,
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
import {
    AgentEventService,
    CompilationKind,
} from '../domain/AgentEventService.ts';
import { EditingLockService } from '../domain/EditingLockService.ts';
import { CompilationService } from '../domain/CompilationService.ts';
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
import { isAgentModePath } from '../utils/agentModePath.ts';
import {
    AgentCheckpointMode,
    AgentCheckpointView,
    agentCheckpointView,
    checkpointBaseOf,
    linkHistoryToRequests,
    withoutRuns,
} from '../utils/agentCheckpoint.ts';

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
    /** Сборка агента в текущем прогоне дала результат: pdf или ошибки */
    private compiledInRun = false;
    /** Последняя сборка в прогоне прошла: PDF собран из того, что агент написал */
    private pdfBuiltInRun = false;
    /** Последняя сборка в прогоне дала, что показать во вкладке результата, как у кнопки Run */
    private resultInRun = false;
    /** Прогон кончился, не доделав задачу: лимит шагов, контекста, времени или квоты */
    private stoppedShort = false;
    /** Перечитать программу не вышло или сокет оборвался: в редакторе может быть старая программа */
    private programMayBeStale = false;
    /** Текст последнего запроса: слишком длинный вернём в поле, чтобы его сократили */
    private lastPrompt = '';
    /**
     * GH-189: перечитывание истории идёт одной очередью. Новый прогон его не
     * отменяет, а запуск и откат его дожидаются: иначе граница встала бы по
     * старой истории, и откат унёс бы запись уже принятого прогона
     */
    private historySync: Promise<boolean> | null = null;
    /** Растёт при очистке истории и смене проекта: ответ, ушедший раньше, в ленту не пишется */
    private historyGeneration = 0;

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
        private compilationService: CompilationService,
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
            compilation_allowed:
                this.repository.persistenceViewModelRepository.agentCompilationAllowed(),
            mode: this.runMode(),
            authorized:
                this.repository.userViewModelRepository.isAuthenticated(),
        };
    }

    /** Сохранённый режим из localStorage: чужое значение, например от отката фронта, сервер не примет, поэтому это agent, как и показывает кнопка */
    private runMode(): AgentRunMode {
        return this.repository.persistenceViewModelRepository.agentRunMode() ===
            'ask'
            ? 'ask'
            : 'agent';
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

    onCompilationAllowedChanged = (value: boolean): void => {
        if (!this.openLoginIfGuest('agent_settings')) {
            return;
        }
        this.repository.persistenceViewModelRepository.setAgentCompilationAllowed(
            value
        );
        this.track(Events.EVENT_AGENT_SETTINGS_CHANGED, {
            setting: 'compilation_allowed',
            value,
        });
    };

    /**
     * Кнопка режима и Shift+Tab в поле запроса. Гостю тоже можно: режим не
     * тратит токены сверх обычного прогона. Во время прогона не трогаем, режим
     * уже ушёл на сервер, и подпись на кнопке соврала бы о текущем прогоне
     */
    onRunModeToggled = (): void => {
        if (this.isRunning()) {
            return;
        }
        const persistence = this.repository.persistenceViewModelRepository;
        const value = persistence.agentRunMode() === 'ask' ? 'agent' : 'ask';
        persistence.setAgentRunMode(value);
        this.track(Events.EVENT_AGENT_SETTINGS_CHANGED, {
            setting: 'mode',
            value,
        });
    };

    /** GH-189: режим отката. Гостю тоже можно: режим не тратит токенов и не трогает сервер */
    onCheckpointModeChanged = (value: AgentCheckpointMode): void => {
        if (this.isRunning()) {
            return;
        }
        this.repository.persistenceViewModelRepository.setAgentCheckpointMode(
            value
        );
        this.track(Events.EVENT_AGENT_SETTINGS_CHANGED, {
            setting: 'checkpoint_mode',
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
        // граница отката могла остаться с прошлого захода или прийти из другой вкладки
        chat.setCheckpointBase(
            this.repository.persistenceViewModelRepository.agentCheckpointBase(
                project.projectId
            )
        );
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
        // перечитывание, ушедшее до очистки, не должно вернуть записи на экран
        this.historyGeneration += 1;
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
        this.compiledInRun = false;
        this.pdfBuiltInRun = false;
        this.resultInRun = false;
        this.stoppedShort = false;
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
        const messages = chat.messages();
        const requestId = messages[messages.length - 1]?.id ?? null;

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

        await this.prepareCheckpoint(requestId);
        if (token !== this.runToken) {
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
            compilationAllowed:
                this.repository.persistenceViewModelRepository.agentCompilationAllowed(),
            mode: this.runMode(),
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
        // GH-179: сверка шла под замком, теперь программа перечитана
        this.hunkService.settleNoOpHunks();
        // сервер дорабатывает прогон и после обрыва, но то, что успело записаться, привяжем
        await this.syncHistory();
    };

    /**
     * GH-189: граница отката ставится в момент запуска. В режиме last правки
     * прошлого прогона перед этим принимаются, но только в агентском режиме: в
     * редакторе они видны и решаются там. Если правок после этого нет, всё,
     * что будет дальше, откатывается целиком: запоминаем последнюю запись
     * истории и запрос этой вкладки. Правки остались, значит граница прежняя
     */
    private prepareCheckpoint = async (
        requestId: number | null
    ): Promise<void> => {
        if (
            this.repository.persistenceViewModelRepository.agentCheckpointMode() ===
                'last' &&
            isAgentModePath(this.repository.location()) &&
            this.hunkService.hasShownHunks()
        ) {
            this.track(Events.EVENT_AGENT_CHECKPOINT_AUTO_ACCEPTED, {
                hunk_count: this.hunkService.shownHunkCount(),
            });
            await this.hunkService.acceptAllForHistoryChange();
        }
        if (this.hunkService.hasShownHunks()) {
            return;
        }
        const chat = this.repository.chatViewModelRepository;
        chat.setCheckpointFromRequestId(requestId);
        const project = this.repository.projectViewModelRepository.project();
        if (
            !project ||
            !this.repository.userViewModelRepository.isAuthenticated()
        ) {
            return;
        }
        // граница по свежей истории с сервера: в ленте может не быть записи прогона,
        // прерванного или оборванного, а сервер дописал её позже. Не вышло, значит
        // граница неизвестна, и откатится одна последняя запись
        const synced = await this.syncHistory();
        if (
            this.repository.projectViewModelRepository.project()?.projectId !==
            project.projectId
        ) {
            return;
        }
        const base = synced ? checkpointBaseOf(chat.history()) : undefined;
        this.repository.persistenceViewModelRepository.setAgentCheckpointBase(
            project.projectId,
            base
        );
        chat.setCheckpointBase(base);
    };

    /**
     * Запись истории появляется на сервере к концу прогона. Перечитываем
     * историю и привязываем новые записи к запросам ленты: так у прогона
     * появляется id для отката, а запись не рисуется второй раз. true, если
     * история на экране совпадает с сервером
     */
    private syncHistory = (): Promise<boolean> => {
        const chat = this.repository.chatViewModelRepository;
        const run = () => this.fetchHistoryLinks();
        // по одному: второй ответ, пришедший раньше первого, перетёр бы свежие привязки старыми
        const sync = (this.historySync ?? Promise.resolve(true)).then(run, run);
        this.historySync = sync;
        chat.setHistorySyncing(true);
        const finish = () => {
            if (this.historySync === sync) {
                this.historySync = null;
                chat.setHistorySyncing(false);
            }
        };
        sync.then(finish, finish);
        return sync;
    };

    private fetchHistoryLinks = async (): Promise<boolean> => {
        const chat = this.repository.chatViewModelRepository;
        const project = this.repository.projectViewModelRepository.project();
        if (
            !project ||
            !this.repository.userViewModelRepository.isAuthenticated()
        ) {
            return false;
        }
        const generation = this.historyGeneration;
        const result = await this.rpi.getAgentHistoryRequest(project.projectId);
        // пока список ехал, очистили историю или открыли другой проект
        if (
            generation !== this.historyGeneration ||
            this.repository.projectViewModelRepository.project()?.projectId !==
                project.projectId ||
            !result.isOk
        ) {
            return false;
        }
        const history = result.body.history ?? [];
        const known = new Set(chat.history().map((entry) => entry.id));
        const messages = chat.messages();
        // у идущего прогона записи ещё нет: его запрос не должен забрать чужую с тем же текстом
        const pending = this.isRunning()
            ? ([...messages].reverse().find((m) => m.kind === 'request')?.id ??
              null)
            : null;
        chat.applyHistoryRefresh(
            history,
            linkHistoryToRequests(
                known,
                history,
                messages,
                chat.entryIdByRequestId(),
                pending
            )
        );
        chat.setHistoryRequestState('ok');
        return true;
    };

    /** Что откатится сейчас. Тот же расчёт рисует подсветку в ленте */
    checkpointView = (): AgentCheckpointView | null => {
        const chat = this.repository.chatViewModelRepository;
        const project = this.repository.projectViewModelRepository.project();
        if (
            !project ||
            this.repository.projectViewModelRepository.projectIsReadonly()
        ) {
            return null;
        }
        return agentCheckpointView({
            hunkCount: this.hunkService.shownHunkCount(),
            authenticated:
                this.repository.userViewModelRepository.isAuthenticated(),
            history: chat.history(),
            links: chat.entryIdByRequestId(),
            messages: chat.messages(),
            fromRequestId: chat.checkpointFromRequestId(),
            base: chat.checkpointBase(),
        });
    };

    /** «Принять» в агентском режиме принимает все правки проекта, а не только подсвеченные */
    onCheckpointAccept = async (): Promise<void> => {
        const view = this.checkpointView();
        if (this.isRunning() || !view) {
            return;
        }
        this.track(Events.EVENT_AGENT_CHECKPOINT_ACCEPTED, {
            mode: this.repository.persistenceViewModelRepository.agentCheckpointMode(),
            hunk_count: this.hunkService.shownHunkCount(),
            entry_count: view.entryIds.length,
        });
        await this.hunkService.acceptAll();
    };

    /**
     * «Откатить»: все правки откатываются, а записи истории подсвеченного
     * куска удаляются. Записи трогаем только после удачного отката правок:
     * иначе в истории не осталось бы запроса, чьи правки ещё в документе
     */
    onCheckpointRevert = async (): Promise<void> => {
        const project = this.repository.projectViewModelRepository.project();
        if (
            this.isRunning() ||
            !project ||
            !this.repository.userViewModelRepository.isAuthenticated()
        ) {
            return;
        }
        const chat = this.repository.chatViewModelRepository;
        // без свежей истории неизвестно, какие записи удалять: правки тогда не трогаем
        if (!(await this.syncHistory())) {
            this.repository.toast(
                this.repository.dictionary.agent_chat.checkpoint
                    .history_unavailable,
                'error'
            );
            return;
        }
        // граница могла смениться в другой вкладке
        chat.setCheckpointBase(
            this.repository.persistenceViewModelRepository.agentCheckpointBase(
                project.projectId
            )
        );
        const view = this.checkpointView();
        if (!view || this.isRunning()) {
            return;
        }
        this.track(Events.EVENT_AGENT_CHECKPOINT_REVERTED, {
            mode: this.repository.persistenceViewModelRepository.agentCheckpointMode(),
            hunk_count: this.hunkService.shownHunkCount(),
            entry_count: view.entryIds.length,
        });
        if (!(await this.hunkService.revertAll())) {
            return;
        }
        const deleted = new Set<string>();
        for (const entryId of view.entryIds) {
            const result = await this.rpi.deleteAgentHistoryEntryRequest(
                project.projectId,
                entryId
            );
            // пропавшую запись сервер пропускает с ответом 200, а 404 значит, что нет проекта
            if (result.isOk) {
                deleted.add(entryId);
            } else if (result.isUnauth) {
                break;
            }
        }
        // пока шли запросы, могли открыть другой проект: его ленту не трогаем
        if (
            this.repository.projectViewModelRepository.project()?.projectId !==
            project.projectId
        ) {
            return;
        }
        const links = chat.entryIdByRequestId();
        // прогон без записи на сервере, например оборванный отказом, уходит вместе с куском
        const dropped = view.requestIds.filter(
            (id) => links[id] === undefined || deleted.has(links[id])
        );
        chat.applyHistoryRefresh(
            chat.history().filter((entry) => !deleted.has(entry.id)),
            links
        );
        chat.setMessages(withoutRuns(chat.messages(), dropped));
        chat.setCheckpointFromRequestId(null);
        if (deleted.size < view.entryIds.length) {
            this.repository.toast(
                this.repository.dictionary.agent_chat.checkpoint.history_failed,
                'error'
            );
        }
    };

    /** Смена проекта: гасим сессию и чистим ленту, чтобы не показывать чужую историю. */
    onProjectChanged = (): void => {
        this.closeSession();
        // перечитывание истории старого проекта в новую ленту не пишем
        this.historyGeneration += 1;
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
            await this.refreshBalance();
            return;
        }

        if (event.kind === 'toolCall') {
            await this.onToolCall(token, event.toolName);
            return;
        }

        // сборка идёт посреди прогона и не завершает его
        if (
            event.kind === 'compilationStarted' ||
            event.kind === 'compilationFinished' ||
            event.kind === 'compilationFailed'
        ) {
            await this.onCompilation(event);
            return;
        }

        await this.onFinished(token, event);
    };

    private refreshBalance = async (): Promise<void> => {
        if (!this.repository.userViewModelRepository.isAuthenticated()) {
            return;
        }
        try {
            await this.tokenPageService.refreshUserInfo();
        } catch (error) {
            // баланс это справка сбоку, его отказ не должен ронять прогон
            console.error(error);
        }
    };

    /** Результат ложится тем же разбором, что у кнопки Run, но показать его не просим: вкладка PDF спрятала бы ленту посреди прогона */
    private onCompilation = async (
        event: Extract<AgentEvent, { kind: CompilationKind }>
    ): Promise<void> => {
        const chat = this.repository.chatViewModelRepository;
        if (event.kind === 'compilationStarted') {
            chat.appendMessage(this.events.describeCompilation(event.kind));
            return;
        }
        this.compiledInRun = true;
        // решает последняя сборка: после ошибки PDF старый или недособранный
        this.pdfBuiltInRun = event.kind === 'compilationFinished';
        this.resultInRun = this.applyCompilation(event);
        chat.appendMessage(this.events.describeCompilation(event.kind));

        // как после кнопки Run: собранный pdf ложится в файлы проекта, а сборка стоит токенов
        const project = this.repository.projectViewModelRepository.project();
        if (
            project &&
            this.repository.userViewModelRepository.isAuthenticated()
        ) {
            await this.loaderService.loadFiles(project.projectId);
        }
        await this.refreshBalance();
    };

    /**
     * Результат по режиму проекта: гостю сервер собирает pdf и в markdown, где вкладка результата рисует только сегменты.
     * true, если во вкладке результата есть что показать: собранный документ или недособранный pdf
     */
    private applyCompilation = (
        event: Extract<
            AgentEvent,
            { kind: 'compilationFinished' | 'compilationFailed' }
        >
    ): boolean => {
        const mode = this.repository.projectViewModelRepository.mode();
        const latex = mode === 'latex';
        const misfit = (hasPdf: boolean, hasMarkdown: boolean) =>
            logBreadcrumb(
                'agent',
                'compilation result does not fit the mode',
                { mode, hasPdf, hasMarkdown },
                'warning'
            );
        if (event.kind === 'compilationFailed') {
            const { errors, unfinishedPdfUri } = event.errors;
            // ошибки относятся к сегментам и нужны в любом режиме, а недособранный pdf только в latex
            this.compilationService.applyCompileErrors(
                latex ? event.errors : { errors }
            );
            if (!latex && unfinishedPdfUri != null) {
                misfit(true, false);
            }
            return latex && unfinishedPdfUri != null;
        }
        if (latex && event.pdfUri != null) {
            this.compilationService.applyPdfResult(event.pdfUri);
            return true;
        }
        if (!latex && event.markdown != null) {
            this.compilationService.applyMarkdownResult(event.markdown);
            return true;
        }
        if (event.pdfUri != null || event.markdown != null) {
            misfit(event.pdfUri != null, event.markdown != null);
        }
        return false;
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

    /** На телефоне чат, редактор и результат разные экраны: после прогона ведём на собранный документ или туда, где агент правил последним */
    onAgentFinishedOnPhone = async (): Promise<void> => {
        const target = this.lastChange;
        // после ошибки и прерывания человеку нужен чат: там текст ошибки или итог прерывания
        if (this.repository.chatViewModelRepository.requestState() !== 'ok') {
            return;
        }
        // GH-165: агент не доделал задачу, и примечание об этом стоит в чате последним
        if (this.stoppedShort) {
            return;
        }
        // агент собрал документ: итог работы это результат, вкладку внутри колонки уже выбрал onFinished
        if (this.resultInRun) {
            this.repository.settingsViewModelRepository.setMobileView('pdf');
            return;
        }
        // без правок человеку нужен чат: там ответ
        if (!target) {
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
            chat.appendMessage({
                kind: 'response',
                text: event.message,
                contextTokens: event.contextTokens,
                maxContextTokens: event.maxContextTokens,
            });
        }
        this.stoppedShort = PARTIAL_STOP_REASONS.includes(event.stopReason);
        if (this.stoppedShort) {
            // прогон не доработал, но изменения применились: это оговорка, а не отказ
            chat.appendMessage({ kind: 'notice', reason: event.stopReason });
        }
        chat.setRequestState('ok');
        // GH-179: правки прогона приезжали под замком, когда программа отставала. Теперь
        // она сверена, и ханки, вернувшие прежний текст, можно убрать
        this.hunkService.settleNoOpHunks();
        // вкладку ставим здесь, а не счётчиком результата: на телефоне он гонялся бы с переходом к правке.
        // GH-165: недоделанный прогон оставляет чат с примечанием, а пустую вкладку не открываем
        if (this.resultInRun && !this.stoppedShort) {
            this.repository.settingsViewModelRepository.setViewerTab('pdf');
        }
        this.track(Events.EVENT_AGENT_FINISHED, {
            ...this.agentSettings(),
            stop_reason: event.stopReason,
            hunk_count: event.hunks?.length ?? this.knownHunks.length,
            compiled: this.compiledInRun,
        });
        await this.showLastChangeInPdf();
        await this.syncHistory();
    };

    /**
     * GH-149: в агентском режиме редактора нет, и правку видно только в PDF.
     * После прогона со сборкой PDF встаёт на первую строку последней правки
     * агента. Не вышло, человеку не говорим, но событие отправляем
     */
    private showLastChangeInPdf = async (): Promise<void> => {
        const target = this.lastChange;
        if (
            !this.pdfBuiltInRun ||
            !target ||
            !isAgentModePath(this.repository.location())
        ) {
            return;
        }
        const result =
            await this.programEditorService.scrollPdfToAgentChange(target);
        if (result.outcome === 'failed') {
            this.track(Events.EVENT_AGENT_PDF_SCROLL_FAILED, {
                code: result.code,
                target: target.file ? 'file' : 'segment',
            });
        }
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
        // после обрыва сервер мог записать прогон в историю: у него появится id для отката
        await this.syncHistory();
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
