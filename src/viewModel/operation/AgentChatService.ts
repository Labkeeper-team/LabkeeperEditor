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
import { ViewModelRepository } from '../repository';
import { IdeService } from '../domain/IdeService.ts';
import { LoaderService } from '../domain/LoaderService.ts';
import { AgentEventService } from '../domain/AgentEventService.ts';
import { EditingLockService } from '../domain/EditingLockService.ts';
import { HunkService } from './HunkService.ts';
import { TextFileEditorService } from './TextFileEditorService.ts';
import { ProgramEditorService } from './ProgramEditorService.ts';
import { TokenPageService } from './TokenPageService.ts';

/** Причины, при которых показываем ошибку, а не ответ. */
const ERROR_STOP_REASONS: AgentStopReason[] = [
    'PaymentRequired',
    'Locked',
    'UnauthorizedLimitExceeded',
    'UnknownError',
];

/** Причины, при которых агент не доработал, но изменения всё равно применились. */
const PARTIAL_STOP_REASONS: AgentStopReason[] = [
    'IterationLimit',
    'ContextOverflow',
    'Timeout',
];

export class AgentChatService {
    private session: AgentSession | null = null;
    private knownHunks: Hunk[] = [];
    /**
     * Номер текущего прогона. Растёт на каждом запуске и на каждом закрытии,
     * поэтому всё, что успело уйти в сеть от прошлого прогона, узнаёт себя
     * по устаревшему номеру и молча выходит вместо записи в чужую ленту.
     */
    private runToken = 0;

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

    isRunning = (): boolean => {
        const state = this.repository.chatViewModelRepository.requestState();
        return state === 'connecting' || state === 'running';
    };

    /** Пользователь попробовал что-то поменять, пока агент работает. */
    onBlockedEditAttempt = (): void => {
        this.editingLock.rejectEdit();
    };

    onInputChanged = (text: string): void => {
        this.repository.chatViewModelRepository.setInput(text);
    };

    onMaxTokensChanged = (value: number): void => {
        this.repository.persistenceViewModelRepository.setAgentMaxTokens(value);
    };

    onIterationsChanged = (value: number): void => {
        this.repository.persistenceViewModelRepository.setAgentIterations(
            value
        );
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
        chat.setHistory([]);
        chat.setMessages([]);
        chat.setHistoryRequestState('ok');
    };

    onPromptSubmit = async (): Promise<void> => {
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

        // слот занимается до первого await, иначе второе нажатие проскочит проверку
        const token = ++this.runToken;
        chat.setRequestState('connecting');
        chat.setInput('');
        chat.appendMessage({
            kind: 'request',
            text: prompt,
            createdAt: new Date().toISOString(),
        });

        const saved = await this.flushPendingSaves();
        // за время сохранения могли уйти со страницы или открыть другой проект
        if (token !== this.runToken) {
            return;
        }
        if (!saved) {
            // агент работает с тем, что лежит на сервере, а там осталась прошлая версия
            chat.appendMessage({ kind: 'error', reason: 'save_failed' });
            chat.setRequestState('error');
            return;
        }

        this.knownHunks = this.repository.ideViewModelRepository.hunks();
        this.observerService.onEvent(Events.EVENT_AGENT_STARTED);

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
                this.onAgentClosed(token, reason),
        };

        if (authenticated && project) {
            this.session = this.agentSocket.startAgent(
                project.projectId,
                params,
                handlers
            );
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
    };

    /** Смена проекта: гасим сессию и чистим ленту, чтобы не показывать чужую историю. */
    onProjectChanged = (): void => {
        this.closeSession();
        this.repository.chatViewModelRepository.reset();
    };

    /** Соединение живёт, пока открыт проект. Закрываем при смене проекта и уходе. */
    closeSession = (): void => {
        this.runToken += 1;
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
            console.error(error);
            this.onAgentClosed(token, 'closed');
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

        this.onFinished(event);
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

        await this.hunkService.loadHunks();
        // hunks ехали из сети, за это время проект мог смениться
        if (token !== this.runToken) {
            return;
        }
        const hunks = this.repository.ideViewModelRepository.hunks();
        const fresh = this.events.newHunks(this.knownHunks, hunks);
        this.knownHunks = hunks;

        for (const draft of this.events.describeToolCall(toolName, fresh)) {
            chat.appendMessage(draft);
        }

        const scope = this.events.reloadScope(fresh);
        if (scope.program) {
            await this.reloadProgram();
        }
        if (scope.files) {
            const project =
                this.repository.projectViewModelRepository.project();
            if (project) {
                await this.loaderService.loadFiles(project.projectId);
            }
        }

        const target = this.events.firstNavigationTarget(fresh);
        if (target) {
            await this.programEditorService.navigateToAgentChange(target);
        }
    };

    private onFinished = (
        event: Extract<AgentEvent, { kind: 'finished' }>
    ): void => {
        const chat = this.repository.chatViewModelRepository;
        this.session = null;
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

        if (isError) {
            chat.appendMessage({ kind: 'error', reason: event.stopReason });
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
        this.observerService.onEvent(Events.EVENT_AGENT_FINISHED);
    };

    private applyUnauthorizedResult = (
        program: Parameters<IdeService['replaceProgram']>[0],
        hunks: Hunk[]
    ): void => {
        // у неавторизованного откат делается только через undo, поэтому replaceProgram
        this.ideService.replaceProgram(program);
        this.hunkService.setHunksFromPrompt(hunks);
        const target = this.events.firstNavigationTarget(hunks);
        if (target) {
            void this.programEditorService.navigateToAgentChange(target);
        }
    };

    private reloadProgram = async (): Promise<void> => {
        const project = this.repository.projectViewModelRepository.project();
        if (!project) {
            return;
        }
        const result = await this.rpi.getProjectRequest(project.projectId);
        if (!result.isOk) {
            return;
        }
        // setNewProgram, а не replaceProgram: двадцать итераций дадут двадцать точек отмены
        this.ideService.setNewProgram(
            result.body.program,
            result.body.lastProgramResult
        );
        await this.textFileEditorService.reloadActiveTextFileIfOpen();
    };

    private reportStopReason = (reason: AgentStopReason): void => {
        if (reason === 'PaymentRequired') {
            this.observerService.onEvent(Events.EVENT_PAYMENT_REQUIRED);
            return;
        }
        if (reason === 'UnauthorizedLimitExceeded') {
            this.repository.authViewModelRepository.setCurrentView('login');
            return;
        }
        if (reason === 'UnknownError') {
            this.observerService.onEvent(Events.EVENT_RPI_UNKNOWN_AGENT);
        }
    };

    private onAgentClosed = (
        token: number,
        reason: AgentClosedReason
    ): void => {
        if (token !== this.runToken) {
            return;
        }
        const chat = this.repository.chatViewModelRepository;
        this.session = null;
        chat.appendMessage({
            kind: 'error',
            reason: reason === 'closed' ? 'disconnected' : reason,
        });
        chat.setRequestState('error');
        if (reason === 'timeout') {
            this.observerService.onEvent(Events.EVENT_AGENT_TIMEOUT);
        }
    };
}
