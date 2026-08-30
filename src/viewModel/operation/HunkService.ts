import { Hunk } from '../../model/domain.ts';
import { Rpi } from '../../model/rpi';
import {
    Events,
    ObserverService,
} from '../../model/service/ObserverService.ts';
import { ViewModelRepository } from '../repository';
import { IdeService } from '../domain/IdeService.ts';
import { LoaderService } from '../domain/LoaderService.ts';
import { TextFileEditorService } from './TextFileEditorService.ts';
import {
    groupHunks,
    hunksForFile,
    hunksForSegment,
} from '../utils/hunkGrouping.ts';

export class HunkService {
    private acceptInFlight = false;

    constructor(
        private repository: ViewModelRepository,
        private rpi: Rpi,
        private ideService: IdeService,
        private loaderService: LoaderService,
        private observerService: ObserverService,
        private textFileEditorService: TextFileEditorService
    ) {}

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
        if (result.isOk) {
            this.repository.ideViewModelRepository.setHunks(
                result.body.hunks ?? []
            );
            await this.textFileEditorService.reloadActiveTextFileIfOpen();
        } else if (result.isUnauth) {
            this.repository.ideViewModelRepository.setHunks([]);
        } else if (!result.isForbidden) {
            this.observerService.onEvent(Events.EVENT_RPI_UNKNOWN_LIST_HUNKS);
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
        if (projectResult.isOk) {
            this.ideService.setNewProgram(
                projectResult.body.program,
                projectResult.body.lastProgramResult
            );
        }
        await this.loaderService.loadFiles(projectId);
        await this.loadHunks();
    }

    private async refreshAfterAccept(): Promise<void> {
        await this.loadHunks();
    }

    acceptGroup = async (hunkIds: string[]): Promise<void> => {
        if (hunkIds.length === 0) {
            return;
        }
        this.markPending(hunkIds);
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
            await Promise.all(
                hunkIds.map((id) =>
                    this.rpi.deleteHunkRequest(projectId, id, false)
                )
            );
            await this.refreshAfterAccept();
        } finally {
            this.unmarkPending(hunkIds);
        }
    };

    revertGroup = async (hunkIds: string[]): Promise<void> => {
        if (hunkIds.length === 0 || !this.canRevertHunks()) {
            return;
        }
        this.markPending(hunkIds);
        try {
            const projectId = this.getProjectId();
            if (!projectId) {
                return;
            }
            for (const id of hunkIds) {
                await this.rpi.deleteHunkRequest(projectId, id, true);
            }
            await this.refreshAfterRevert();
        } finally {
            this.unmarkPending(hunkIds);
        }
    };

    acceptAll = async (): Promise<void> => {
        const hunks = this.repository.ideViewModelRepository.hunks();
        const ids = hunks.map((h) => h.id);
        await this.acceptGroup(ids);
    };

    revertAll = async (): Promise<void> => {
        if (!this.canRevertHunks()) {
            return;
        }
        const hunks = this.repository.ideViewModelRepository.hunks();
        const ids = hunks.map((h) => h.id);
        this.markPending(ids);
        try {
            const projectId = this.getProjectId();
            if (!projectId) {
                return;
            }
            for (const id of ids) {
                await this.rpi.deleteHunkRequest(projectId, id, true);
            }
            await this.refreshAfterRevert();
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
        if (hunkIds.length === 0 || this.acceptInFlight) {
            if (hunkIds.length > 0) {
                this.removeHunksLocally(hunkIds);
            }
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
        this.acceptInFlight = true;
        void (async () => {
            try {
                await Promise.all(
                    hunkIds.map((id) =>
                        this.rpi.deleteHunkRequest(projectId, id, false)
                    )
                );
                await this.loadHunks();
            } finally {
                this.acceptInFlight = false;
            }
        })();
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
