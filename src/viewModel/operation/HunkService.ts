import { Hunk } from '../../model/domain.ts';
import { Rpi } from '../../model/rpi';
import { ViewModelRepository } from '../repository';
import { IdeService } from '../domain/IdeService.ts';
import { LoaderService } from '../domain/LoaderService.ts';
import { TextFileEditorService } from './TextFileEditorService.ts';
import { EditingLockService } from '../domain/EditingLockService.ts';
import {
    groupHunks,
    hunksForFile,
    hunksForSegment,
} from '../utils/hunkGrouping.ts';
import {
    Events,
    ObserverService,
} from '../../model/service/ObserverService.ts';
import { trackEvent } from '../utils/observerContext.ts';

/** Чем кончилась пачка DELETE. Отказы разведены: лечатся они по-разному. */
interface DeleteOutcome {
    failed: number;
    unauth: boolean;
    forbidden: boolean;
}

export class HunkService {
    private acceptInFlight = false;
    // id, накопленные фоновым приёмом, пока шла предыдущая отправка
    private backgroundAcceptQueue: string[] = [];
    // общая очередь удалений: пути приёма и отката друг о друге не знают,
    // а набор текста запускает приём поверх любого из них
    private deleteChain: Promise<void> = Promise.resolve();

    constructor(
        private repository: ViewModelRepository,
        private rpi: Rpi,
        private ideService: IdeService,
        private loaderService: LoaderService,
        private textFileEditorService: TextFileEditorService,
        private editingLock: EditingLockService,
        private observerService: ObserverService
    ) {}

    private track(event: string, properties?: Record<string, unknown>) {
        trackEvent(this.observerService, this.repository, event, properties);
    }

    shouldShowHunks = (): boolean => {
        if (this.repository.projectViewModelRepository.projectIsReadonly()) {
            return false;
        }
        if (!this.repository.userViewModelRepository.isAuthenticated()) {
            return false;
        }
        return true;
    };

    canRevertHunks = (): boolean => {
        return this.shouldShowHunks();
    };

    /** false, если список на экране может расходиться с сервером */
    loadHunks = async (): Promise<boolean> => {
        if (!this.shouldShowHunks()) {
            this.repository.ideViewModelRepository.setHunks([]);
            return true;
        }
        const project = this.repository.projectViewModelRepository.project();
        if (!project) {
            return false;
        }
        const result = await this.rpi.listHunksRequest(project.projectId);
        // пока hunks ехали, могли открыть другой проект, чужие ему ни к чему
        if (
            this.repository.projectViewModelRepository.project()?.projectId !==
            project.projectId
        ) {
            return false;
        }
        if (result.isOk) {
            const nextHunks = result.body.hunks ?? [];
            this.repository.ideViewModelRepository.setHunks(nextHunks);
            await this.textFileEditorService.reloadActiveTextFileIfOpen(
                nextHunks
            );
            return true;
        }
        if (result.isUnauth) {
            // сессия кончилась: своих правок у гостя нет, и пустой список тут верен
            this.repository.ideViewModelRepository.setHunks([]);
            return true;
        }
        return false;
    };

    setHunksFromPrompt = (hunks: Hunk[]): void => {
        this.repository.ideViewModelRepository.setHunks(hunks);
        void this.textFileEditorService.reloadActiveTextFileIfOpen();
    };

    clearHunks = (): void => {
        this.repository.ideViewModelRepository.setHunks([]);
        this.repository.ideViewModelRepository.setPendingHunkIds([]);
    };

    private getProjectId = (): string | null => {
        return (
            this.repository.projectViewModelRepository.project()?.projectId ??
            null
        );
    };

    private deleteHunkOnServer = async (
        projectId: string,
        hunkId: string,
        revert: boolean
    ) => {
        return this.rpi.deleteHunkRequest(projectId, hunkId, revert);
    };

    // единственная дверь к DELETE: очередь одна на сервис, иначе соседние
    // пути шлют запросы одновременно и удаляют один ханк дважды
    private deleteHunksOneByOne = (
        projectId: string,
        hunkIds: string[],
        revert: boolean
    ): Promise<DeleteOutcome> => {
        const run = () => this.sendDeletes(projectId, hunkIds, revert);
        // ждём цепочку обоими концами: отказ соседа не должен её порвать
        const outcome = this.deleteChain.then(run, run);
        this.deleteChain = outcome.then(
            () => undefined,
            () => undefined
        );
        return outcome;
    };

    // 404 значит, что ханка на сервере уже нет, для нас это такой же успех
    private sendDeletes = async (
        projectId: string,
        hunkIds: string[],
        revert: boolean
    ): Promise<DeleteOutcome> => {
        const outcome: DeleteOutcome = {
            failed: 0,
            unauth: false,
            forbidden: false,
        };
        for (const id of hunkIds) {
            const result = await this.deleteHunkOnServer(projectId, id, revert);
            if (result.isOk || result.code === 404) {
                continue;
            }
            if (result.isUnauth) {
                // сессии нет, остальные запросы пачки вернут то же самое
                outcome.unauth = true;
                break;
            }
            if (result.isForbidden) {
                outcome.forbidden = true;
                continue;
            }
            outcome.failed += 1;
        }
        return outcome;
    };

    // истёкшую сессию и потерю доступа повтор не лечит, поэтому говорим о них
    // отдельно и так же, как соседние сервисы
    private reportDeleteOutcome = (
        outcome: DeleteOutcome,
        failureMessage: string
    ): void => {
        if (outcome.unauth) {
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.sessionExpired,
                'error'
            );
            this.ideService.resetEditor();
            return;
        }
        if (outcome.forbidden) {
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.notEnoughRights,
                'error'
            );
            return;
        }
        if (outcome.failed === 0) {
            return;
        }
        this.repository.toast(failureMessage, 'error');
    };

    private reportAcceptFailure = (outcome: DeleteOutcome): void => {
        this.reportDeleteOutcome(
            outcome,
            this.repository.dictionary.hunks.errors.accept_failed
        );
    };

    private reportRevertFailure = (outcome: DeleteOutcome): void => {
        this.reportDeleteOutcome(
            outcome,
            this.repository.dictionary.hunks.errors.revert_failed
        );
    };

    private markPending = (ids: string[]): void => {
        const current = this.repository.ideViewModelRepository.pendingHunkIds();
        this.repository.ideViewModelRepository.setPendingHunkIds([
            ...new Set([...current, ...ids]),
        ]);
    };

    private unmarkPending = (ids: string[]): void => {
        const pending = new Set(
            this.repository.ideViewModelRepository.pendingHunkIds()
        );
        ids.forEach((id) => pending.delete(id));
        this.repository.ideViewModelRepository.setPendingHunkIds([...pending]);
    };

    private async refreshAfterRevert(): Promise<void> {
        const projectId = this.getProjectId();
        if (!projectId) {
            return;
        }
        const projectResult = await this.rpi.getProjectRequest(projectId);
        await this.loaderService.loadFiles(projectId);
        await this.loadHunks();
        if (projectResult.isOk) {
            this.ideService.setNewProgram(
                projectResult.body.program,
                projectResult.body.lastProgramResult
            );
        }
    }

    private async refreshAfterAccept(): Promise<void> {
        await this.loadHunks();
    }

    acceptGroup = async (
        hunkIds: string[],
        options?: { skipObserver?: boolean }
    ): Promise<void> => {
        if (this.editingLock.rejectEdit()) {
            return;
        }
        if (hunkIds.length === 0) {
            return;
        }
        this.markPending(hunkIds);
        if (!options?.skipObserver) {
            this.track(Events.EVENT_HUNK_ACCEPTED, {
                scope: 'group',
                hunk_count: hunkIds.length,
            });
        }
        try {
            if (!this.repository.userViewModelRepository.isAuthenticated()) {
                await Promise.resolve();
                this.removeHunksLocally(hunkIds);
                return;
            }
            const projectId = this.getProjectId();
            if (!projectId) {
                return;
            }
            // шлём по одному, как и откат, и смотрим на ответ каждого запроса
            const outcome = await this.deleteHunksOneByOne(
                projectId,
                hunkIds,
                false
            );
            await this.refreshAfterAccept();
            this.reportAcceptFailure(outcome);
        } finally {
            this.unmarkPending(hunkIds);
        }
    };

    revertGroup = async (hunkIds: string[]): Promise<void> => {
        if (this.editingLock.rejectEdit()) {
            return;
        }
        if (hunkIds.length === 0 || !this.canRevertHunks()) {
            return;
        }
        this.markPending(hunkIds);
        this.track(Events.EVENT_HUNK_REVERTED, {
            scope: 'group',
            hunk_count: hunkIds.length,
        });
        try {
            const projectId = this.getProjectId();
            if (!projectId) {
                return;
            }
            const outcome = await this.deleteHunksOneByOne(
                projectId,
                hunkIds,
                true
            );
            await this.refreshAfterRevert();
            this.reportRevertFailure(outcome);
        } finally {
            this.unmarkPending(hunkIds);
        }
    };

    acceptAll = async (): Promise<void> => {
        if (this.editingLock.rejectEdit()) {
            return;
        }
        const hunks = this.repository.ideViewModelRepository.hunks();
        const ids = hunks.map((h) => h.id);
        this.track(Events.EVENT_HUNKS_ACCEPTED_ALL, {
            hunk_count: ids.length,
        });
        await this.acceptGroup(ids, { skipObserver: true });
    };

    acceptAllForHistoryChange = async (): Promise<void> => {
        const ids = this.repository.ideViewModelRepository
            .hunks()
            .map((h) => h.id);
        if (ids.length === 0) {
            return;
        }
        this.removeHunksLocally(ids);
        if (!this.repository.userViewModelRepository.isAuthenticated()) {
            return;
        }
        const projectId = this.getProjectId();
        if (!projectId) {
            return;
        }
        const outcome = await this.deleteHunksOneByOne(projectId, ids, false);
        await this.loadHunks();
        this.reportAcceptFailure(outcome);
    };

    revertAll = async (): Promise<void> => {
        if (this.editingLock.rejectEdit()) {
            return;
        }
        if (!this.canRevertHunks()) {
            return;
        }
        const hunks = this.repository.ideViewModelRepository.hunks();
        const ids = hunks.map((h) => h.id);
        this.track(Events.EVENT_HUNKS_REVERTED_ALL, {
            hunk_count: ids.length,
        });
        this.markPending(ids);
        try {
            const projectId = this.getProjectId();
            if (!projectId) {
                return;
            }
            const outcome = await this.deleteHunksOneByOne(
                projectId,
                ids,
                true
            );
            await this.refreshAfterRevert();
            this.reportRevertFailure(outcome);
        } finally {
            this.unmarkPending(ids);
        }
    };

    removeHunksLocally = (hunkIds: string[]): void => {
        const remove = new Set(hunkIds);
        const next = this.repository.ideViewModelRepository
            .hunks()
            .filter((h) => !remove.has(h.id));
        this.repository.ideViewModelRepository.setHunks(next);
    };

    acceptHunksInBackground = (hunkIds: string[]): void => {
        if (hunkIds.length === 0) {
            return;
        }
        this.removeHunksLocally(hunkIds);
        if (!this.repository.userViewModelRepository.isAuthenticated()) {
            return;
        }
        const projectId = this.getProjectId();
        if (!projectId) {
            return;
        }
        // эти id уже удаляет явный приём или откат: второй DELETE ушёл бы
        // впустую, а поверх отката ещё и отменил бы его
        const busy = new Set([
            ...this.repository.ideViewModelRepository.pendingHunkIds(),
            ...this.backgroundAcceptQueue,
        ]);
        const fresh = hunkIds.filter((id) => !busy.has(id));
        if (fresh.length === 0) {
            return;
        }
        // при занятой отправке ханки нельзя бросать: с экрана убраны, а на сервере нет
        this.backgroundAcceptQueue.push(...fresh);
        if (this.acceptInFlight) {
            return;
        }
        this.acceptInFlight = true;
        void this.drainBackgroundAccept(projectId);
    };

    private drainBackgroundAccept = async (
        projectId: string
    ): Promise<void> => {
        try {
            const total: DeleteOutcome = {
                failed: 0,
                unauth: false,
                forbidden: false,
            };
            while (this.backgroundAcceptQueue.length > 0) {
                const batch = this.backgroundAcceptQueue.splice(0);
                const outcome = await this.deleteHunksOneByOne(
                    projectId,
                    batch,
                    false
                );
                total.failed += outcome.failed;
                total.unauth = total.unauth || outcome.unauth;
                total.forbidden = total.forbidden || outcome.forbidden;
                // перечитываем внутри круга: пока список ехал, могла прийти новая пачка
                await this.loadHunks();
            }
            this.reportAcceptFailure(total);
        } finally {
            this.acceptInFlight = false;
        }
    };

    acceptAllHunksInBackground = (): void => {
        const ids = this.repository.ideViewModelRepository
            .hunks()
            .map((h) => h.id);
        this.acceptHunksInBackground(ids);
    };

    acceptHunksForSegment = (segmentId: number): void => {
        const ids = hunksForSegment(
            this.repository.ideViewModelRepository.hunks(),
            segmentId
        ).map((h) => h.id);
        this.acceptHunksInBackground(ids);
    };

    acceptHunksForFile = (fileName: string): void => {
        const ids = hunksForFile(
            this.repository.ideViewModelRepository.hunks(),
            fileName
        ).map((h) => h.id);
        this.acceptHunksInBackground(ids);
    };

    getGroupedHunks = () => {
        return groupHunks(this.repository.ideViewModelRepository.hunks());
    };
}
