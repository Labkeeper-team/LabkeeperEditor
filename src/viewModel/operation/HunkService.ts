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

export class HunkService {
    private acceptInFlight = false;
    // id, накопленные фоновым приёмом, пока шла предыдущая отправка
    private backgroundAcceptQueue: string[] = [];

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

    loadHunks = async (): Promise<void> => {
        if (!this.shouldShowHunks()) {
            this.repository.ideViewModelRepository.setHunks([]);
            return;
        }
        const project = this.repository.projectViewModelRepository.project();
        if (!project) {
            return;
        }
        const result = await this.rpi.listHunksRequest(project.projectId);
        // пока hunks ехали, могли открыть другой проект, чужие ему ни к чему
        if (
            this.repository.projectViewModelRepository.project()?.projectId !==
            project.projectId
        ) {
            return;
        }
        if (result.isOk) {
            const nextHunks = result.body.hunks ?? [];
            this.repository.ideViewModelRepository.setHunks(nextHunks);
            await this.textFileEditorService.reloadActiveTextFileIfOpen(
                nextHunks
            );
        } else if (result.isUnauth) {
            this.repository.ideViewModelRepository.setHunks([]);
        }
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

    // 404 значит, что ханка на сервере уже нет, для нас это такой же успех
    private deleteHunksOneByOne = async (
        projectId: string,
        hunkIds: string[],
        revert: boolean
    ): Promise<number> => {
        let failed = 0;
        for (const id of hunkIds) {
            const result = await this.deleteHunkOnServer(projectId, id, revert);
            if (!result.isOk && result.code !== 404) {
                failed += 1;
            }
        }
        return failed;
    };

    private reportAcceptFailure = (failed: number): void => {
        if (failed === 0) {
            return;
        }
        this.repository.toast(
            this.repository.dictionary.hunks.errors.accept_failed,
            'error'
        );
    };

    private reportRevertFailure = (failed: number): void => {
        if (failed === 0) {
            return;
        }
        this.repository.toast(
            this.repository.dictionary.hunks.errors.revert_failed,
            'error'
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
            const failed = await this.deleteHunksOneByOne(
                projectId,
                hunkIds,
                false
            );
            await this.refreshAfterAccept();
            this.reportAcceptFailure(failed);
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
            const failed = await this.deleteHunksOneByOne(
                projectId,
                hunkIds,
                true
            );
            await this.refreshAfterRevert();
            this.reportRevertFailure(failed);
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
        const failed = await this.deleteHunksOneByOne(projectId, ids, false);
        await this.loadHunks();
        this.reportAcceptFailure(failed);
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
            const failed = await this.deleteHunksOneByOne(projectId, ids, true);
            await this.refreshAfterRevert();
            this.reportRevertFailure(failed);
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
        // при занятой отправке ханки нельзя бросать: с экрана убраны, а на сервере нет
        this.backgroundAcceptQueue.push(...hunkIds);
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
            let failed = 0;
            while (this.backgroundAcceptQueue.length > 0) {
                const batch = this.backgroundAcceptQueue.splice(0);
                failed += await this.deleteHunksOneByOne(
                    projectId,
                    batch,
                    false
                );
                // перечитываем внутри круга: пока список ехал, могла прийти новая пачка
                await this.loadHunks();
            }
            this.reportAcceptFailure(failed);
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
