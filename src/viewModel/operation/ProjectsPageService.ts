import { ViewModelRepository } from '../repository';
import { Rpi } from '../../model/rpi';
import { LoaderService } from '../domain/LoaderService.ts';
import { IdeService } from '../domain/IdeService.ts';
import { StartupService } from './StartupService.ts';
import { Program, Project, ProjectType } from '../../model/domain.ts';
import { Routes } from '../routes.ts';
import {
    Events,
    ObserverService,
} from '../../model/service/ObserverService.ts';
import { normalizeTagLabel } from '../../view/pages/projects/tagColorUtils.ts';

const findTagLabelByCaseInsensitive = (
    tags: Record<string, string>,
    label: string
): string | null => {
    const target = label.toLocaleLowerCase();
    for (const existingLabel of Object.keys(tags)) {
        if (existingLabel.toLocaleLowerCase() === target) {
            return existingLabel;
        }
    }
    return null;
};

const findGlobalTagByCaseInsensitive = (
    byProject: Record<string, Record<string, string>>,
    label: string
): { label: string; color: string } | null => {
    const target = label.toLocaleLowerCase();
    for (const tags of Object.values(byProject)) {
        for (const [existingLabel, existingColor] of Object.entries(tags)) {
            if (existingLabel.toLocaleLowerCase() === target) {
                return {
                    label: existingLabel,
                    color: existingColor,
                };
            }
        }
    }
    return null;
};

export class ProjectsPageService {
    repository: ViewModelRepository;
    rpi: Rpi;
    loaderService: LoaderService;
    ideService: IdeService;
    startupService: StartupService;
    observerService: ObserverService;

    constructor(
        repository: ViewModelRepository,
        rpi: Rpi,
        loaderService: LoaderService,
        ideService: IdeService,
        startupService: StartupService,
        observerService: ObserverService
    ) {
        this.rpi = rpi;
        this.loaderService = loaderService;
        this.ideService = ideService;
        this.startupService = startupService;
        this.repository = repository;
        this.observerService = observerService;
    }

    onDeleteProject = async (projectId: string, okCallback: () => void) => {
        const result1 = await this.rpi.deleteProjectRequest(projectId);
        if (result1.isOk) {
            okCallback();
            const result2 = await this.rpi.getAllProjectsRequest();
            if (result2.isOk) {
                this.repository.projectsViewModelRepository.setProjects(
                    (result2.body as { projects: Array<Project> }).projects
                );
            }
            if (result2.isUnauth) {
                this.repository.toast(
                    this.repository.dictionary.filemanager.errors
                        .sessionExpired,
                    'error'
                );
                this.ideService.resetEditor();
            } else if (!result2.isOk) {
                this.observerService.onEvent(
                    Events.EVENT_RPI_UNKNOWN_PROJECTS_GET_ALL_PROJECTS
                );
            }
        }
        if (result1.isUnauth) {
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.sessionExpired,
                'error'
            );
            this.ideService.resetEditor();
        } else if (!result1.isOk) {
            this.observerService.onEvent(
                Events.EVENT_RPI_UNKNOWN_PROJECTS_DELETE_PROJECT
            );
        }
    };

    onProjectCreate = async (
        projectName: string,
        projectType: ProjectType,
        okCallback: () => void,
        errorCallback: (message: string) => void
    ) => {
        const projectNameToSend = projectName.trim();
        if (!projectNameToSend) {
            errorCallback(
                this.repository.dictionary.create_modal.error.empty_name
            );
            return;
        }

        const emptyProject: Program = {
            segments: [],
            parameters: {
                roundStrategy: 'noRound',
            },
        };

        const result = await this.rpi.createProjectRequest(
            projectName,
            emptyProject
        );
        if (result.isUnauth) {
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.sessionExpired,
                'error'
            );
            this.ideService.resetEditor();
        }
        if (result.isOk) {
            this.repository.setLocation(
                Routes.Project.replace(':id', result.body.projectId + '')
            );

            this.repository.projectViewModelRepository.setProject(result.body);
            await this.loaderService.loadProjects();
            this.repository.projectViewModelRepository.setReadOnly(false);
            this.repository.projectViewModelRepository.setProjectType(
                projectType
            );
            const setTypeResult = await this.rpi.setProjectTypeRequest(
                result.body.projectId,
                projectType
            );

            if (setTypeResult.isUnauth) {
                this.repository.toast(
                    this.repository.dictionary.filemanager.errors
                        .sessionExpired,
                    'error'
                );
                this.ideService.resetEditor();
            }

            if (setTypeResult.isOk) {
                this.repository.projectViewModelRepository.setProject({
                    ...result.body,
                    projectType: projectType,
                });
                this.repository.projectViewModelRepository.setReadOnly(false);
            } else if (!setTypeResult.isUnauth) {
                this.observerService.onEvent(
                    Events.EVENT_RPI_UNKNOWN_PROJECTS_SET_PROJECT_TYPE
                );
            }
            okCallback();
        } else {
            if (result.code !== 417 && !result.isUnauth) {
                this.observerService.onEvent(
                    Events.EVENT_RPI_UNKNOWN_PROJECTS_CREATE_PROJECT
                );
            }
            const message =
                result.code === 417
                    ? this.repository.dictionary.create_modal.error
                          .too_many_projects
                    : result.code.toString();
            errorCallback(message);
        }
    };

    onRowClickedInProjectsList = async (projectId: string) => {
        this.repository.setLocation(Routes.Project.replace(':id', projectId));
        await this.startupService.openProjectById(
            {
                isAuthenticated:
                    this.repository.userViewModelRepository.isAuthenticated(),
                id: this.repository.userViewModelRepository.id(),
                email: this.repository.userViewModelRepository.email(),
                tokens: this.repository.userViewModelRepository.tokens(),
            },
            projectId
        );
    };

    addTagToProject = async (
        projectId: string,
        tagLabel: string,
        color: string
    ): Promise<void> => {
        const normalizedLabel = normalizeTagLabel(tagLabel);
        if (!projectId || !normalizedLabel) {
            return;
        }

        const previousByProject =
            this.repository.projectsViewModelRepository.byProject();
        const previousProjectTags = previousByProject[projectId] ?? {};
        const existingLabel = findTagLabelByCaseInsensitive(
            previousProjectTags,
            normalizedLabel
        );
        if (existingLabel) {
            return;
        }
        const existingGlobalTag = findGlobalTagByCaseInsensitive(
            previousByProject,
            normalizedLabel
        );

        const nextProjectTags: Record<string, string> = {
            ...previousProjectTags,
            [normalizedLabel]: existingGlobalTag?.color ?? color,
        };

        this.repository.projectsViewModelRepository.setForProject({
            projectId,
            tags: nextProjectTags,
        });

        const result = await this.rpi.updateProjectTagsRequest(
            projectId,
            nextProjectTags
        );
        if (result.isOk) {
            return;
        }

        this.repository.projectsViewModelRepository.setForProject({
            projectId,
            tags: previousProjectTags,
        });

        if (result.isUnauth) {
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.sessionExpired,
                'error'
            );
            return;
        }

        this.observerService.onEvent(
            Events.EVENT_RPI_UNKNOWN_PROJECTS_UPDATE_TAGS
        );
    };

    removeTagFromProject = async (
        projectId: string,
        tagLabel: string
    ): Promise<void> => {
        const normalizedLabel = normalizeTagLabel(tagLabel);
        if (!projectId || !normalizedLabel) {
            return;
        }

        const previousByProject =
            this.repository.projectsViewModelRepository.byProject();
        const previousProjectTags = previousByProject[projectId] ?? {};
        const existingLabel = findTagLabelByCaseInsensitive(
            previousProjectTags,
            normalizedLabel
        );
        if (!existingLabel) {
            return;
        }

        const nextProjectTags = Object.fromEntries(
            Object.entries(previousProjectTags).filter(
                ([label]) => label !== existingLabel
            )
        );

        this.repository.projectsViewModelRepository.setForProject({
            projectId,
            tags: nextProjectTags,
        });

        const result = await this.rpi.updateProjectTagsRequest(
            projectId,
            nextProjectTags
        );
        if (result.isOk) {
            return;
        }

        this.repository.projectsViewModelRepository.setForProject({
            projectId,
            tags: previousProjectTags,
        });

        if (result.isUnauth) {
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.sessionExpired,
                'error'
            );
            return;
        }

        this.observerService.onEvent(
            Events.EVENT_RPI_UNKNOWN_PROJECTS_UPDATE_TAGS
        );
    };
}
