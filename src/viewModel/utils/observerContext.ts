import { SegmentType } from '../../model/domain.ts';
import {
    Events,
    ObserverEventProperties,
    ObserverService,
} from '../../model/service/ObserverService.ts';
import { ViewModelRepository } from '../repository';

export function observerContext(
    repository: ViewModelRepository
): ObserverEventProperties {
    const project = repository.projectViewModelRepository.project();
    return {
        ...(project?.projectId ? { project_id: project.projectId } : {}),
        project_type: repository.projectViewModelRepository.mode(),
        is_authenticated: repository.userViewModelRepository.isAuthenticated(),
        is_readonly: repository.projectViewModelRepository.projectIsReadonly(),
        path:
            typeof window !== 'undefined'
                ? window.location.pathname
                : repository.location(),
    };
}

export function trackEvent(
    observer: ObserverService,
    repository: ViewModelRepository,
    event: string,
    properties?: ObserverEventProperties
) {
    observer.onEvent(event, {
        ...observerContext(repository),
        ...properties,
    });
}

export function fileExtension(fileName: string): string | undefined {
    const slash = fileName.lastIndexOf('/');
    const name = slash >= 0 ? fileName.slice(slash + 1) : fileName;
    const dot = name.lastIndexOf('.');
    if (dot <= 0 || dot === name.length - 1) {
        return undefined;
    }
    return name.slice(dot + 1).toLowerCase();
}

export function segmentCreateEvent(type: SegmentType): string {
    switch (type) {
        case 'md':
            return Events.EVENT_CREATE_MD_SEGMENT;
        case 'asciimath':
            return Events.EVENT_CREATE_ASCIIMATH_SEGMENT;
        case 'latex':
            return Events.EVENT_CREATE_LATEX_SEGMENT;
        case 'computational':
            return Events.EVENT_CREATE_COMP_SEGMENT;
        case 'empty':
            return Events.EVENT_CREATE_MD_SEGMENT;
    }
}
