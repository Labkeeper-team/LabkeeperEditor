import { useDispatch, useSelector } from 'react-redux';
import { formatDistance } from 'date-fns';
import { enGB, ru } from 'date-fns/locale';
import React, {
    useCallback,
    useMemo,
    useState,
    useEffect,
    useLayoutEffect,
    useRef,
} from 'react';

import './style.scss';
import { Typography } from '../../components/typography';
import { Button } from '../../components/button';
import { CheckIcon, CloseIcon, PlusIcon } from '../../icons';
import { Modal } from '../../components/modal';
import { AddProjectModal } from './addProjectModal';
import { DeleteProjectModal } from './deleteProjectModal';
import { ProjectShort } from '../../../model/domain';
import { ProjectTitle } from './projectTitle';
import { useProjects } from '../../store/selectors/program';
import { colors } from '../../styles/colors';
import {
    useCurrentLanguage,
    useDictionary,
} from '../../store/selectors/translations';
import { AppDispatch, StorageState } from '../../store';
import { controller } from '../../../main.tsx';
import { ProjectTagsStubService } from '../../../viewModel/operation/ProjectTagsStubService.ts';

type SortMode = 'time' | 'title';
type SortDirection = 'asc' | 'desc';
type TagDropdownPlacement = 'top' | 'bottom';

export const ProjectsPage = () => {
    const [showAddModal, setShowAddModal] = useState(false);
    const [showTagsFilterModal, setShowTagsFilterModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState<
        false | ProjectShort
    >(false);
    const [sortMode, setSortMode] = useState<SortMode>('time');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [projectTags, setProjectTags] = useState<Record<string, string[]>>(
        {}
    );
    const [openedTagPickerProjectId, setOpenedTagPickerProjectId] = useState<
        string | null
    >(null);
    const [tagDropdownPlacement, setTagDropdownPlacement] =
        useState<TagDropdownPlacement>('bottom');
    const [isTagDropdownReady, setIsTagDropdownReady] = useState(false);
    const [newTagByProject, setNewTagByProject] = useState<
        Record<string, string>
    >({});
    const [selectedFilterTags, setSelectedFilterTags] = useState<string[]>([]);
    const [singleLineTagsByProject, setSingleLineTagsByProject] = useState<
        Record<string, boolean>
    >({});
    const openedDropdownRef = useRef<HTMLDivElement | null>(null);
    const tagsFilterAnchorRef = useRef<HTMLDivElement | null>(null);
    const projectsScrollContainerRef = useRef<HTMLDivElement | null>(null);
    const projectTagsCellRefs = useRef<Record<string, HTMLDivElement | null>>(
        {}
    );
    const tagButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

    const dictionary = useSelector(useDictionary);
    const lang = useSelector(useCurrentLanguage);
    const projects = useSelector(useProjects);
    const getProjectsRequestState = useSelector(
        (state: StorageState) => state.ide.getProjectsRequestState
    );
    const dispatch = useDispatch<AppDispatch>();
    const projectTagsService = useMemo(() => new ProjectTagsStubService(), []);
    const tagsCollator = useMemo(
        () =>
            new Intl.Collator(['en', 'ru'], {
                sensitivity: 'base',
                numeric: true,
            }),
        []
    );

    useEffect(() => {
        const ids = projects
            .map((project) => project.projectId)
            .filter((id): id is string => !!id);
        setProjectTags(projectTagsService.getProjectTags(ids));
    }, [projects, projectTagsService]);

    useEffect(() => {
        Object.values(projectTagsCellRefs.current).forEach((cell) => {
            if (cell) {
                cell.scrollTop = 0;
            }
        });
    }, [projectTags]);

    const recalculateTagsRowsLayout = useCallback(() => {
        const next: Record<string, boolean> = {};
        for (const project of projects) {
            const cell = projectTagsCellRefs.current[project.projectId];
            if (!cell) {
                continue;
            }
            const children = Array.from(cell.children) as HTMLElement[];
            if (children.length <= 1) {
                next[project.projectId] = true;
                continue;
            }
            const firstTop = children[0].offsetTop;
            next[project.projectId] = children.every(
                (child) => child.offsetTop === firstTop
            );
        }
        setSingleLineTagsByProject(next);
    }, [projects]);

    useLayoutEffect(() => {
        recalculateTagsRowsLayout();
    }, [projectTags, projects, recalculateTagsRowsLayout]);

    useEffect(() => {
        window.addEventListener('resize', recalculateTagsRowsLayout);
        return () => {
            window.removeEventListener('resize', recalculateTagsRowsLayout);
        };
    }, [recalculateTagsRowsLayout]);

    useEffect(() => {
        if (!showTagsFilterModal) {
            return;
        }
        setOpenedTagPickerProjectId(null);
        setIsTagDropdownReady(false);
    }, [showTagsFilterModal]);

    useEffect(() => {
        if (!showTagsFilterModal) {
            return;
        }
        const onGlobalClick = (event: MouseEvent) => {
            if (!tagsFilterAnchorRef.current) {
                return;
            }
            if (!tagsFilterAnchorRef.current.contains(event.target as Node)) {
                setShowTagsFilterModal(false);
            }
        };
        document.addEventListener('mousedown', onGlobalClick);
        return () => {
            document.removeEventListener('mousedown', onGlobalClick);
        };
    }, [showTagsFilterModal]);

    const applyDropdownPlacement = useCallback(
        (triggerRect: DOMRect, dropdownHeight: number) => {
            const viewport = window.visualViewport;
            const viewportTop = 0;
            const viewportBottom = Math.max(
                0,
                Math.floor(viewport?.height ?? window.innerHeight)
            );
            const scrollContainerRect =
                projectsScrollContainerRef.current?.getBoundingClientRect();
            // Strict fit inside the actual projects list viewport.
            const boundaryTop = scrollContainerRect
                ? Math.max(viewportTop, scrollContainerRect.top)
                : viewportTop;
            const boundaryBottom = scrollContainerRect
                ? Math.min(viewportBottom, scrollContainerRect.bottom)
                : viewportBottom;
            const availableBelow = Math.max(
                0,
                boundaryBottom - triggerRect.bottom
            );
            const availableAbove = Math.max(0, triggerRect.top - boundaryTop);
            const requiredHeight = dropdownHeight / 0.95;
            const fitsBelow = availableBelow >= requiredHeight;
            const fitsAbove = availableAbove >= requiredHeight;
            const nextPlacement: TagDropdownPlacement = fitsBelow
                ? 'bottom'
                : fitsAbove
                  ? 'top'
                  : 'top';
            if (nextPlacement !== tagDropdownPlacement) {
                setTagDropdownPlacement(nextPlacement);
            }
        },
        [tagDropdownPlacement]
    );

    const recalculateDropdownPlacement = useCallback(() => {
        if (!openedTagPickerProjectId) {
            return;
        }
        const triggerElement = tagButtonRefs.current[openedTagPickerProjectId];
        if (!triggerElement) {
            return;
        }
        const triggerRect = triggerElement.getBoundingClientRect();
        const dropdownHeight =
            openedDropdownRef.current?.getBoundingClientRect().height ?? 250;
        applyDropdownPlacement(triggerRect, dropdownHeight);
        setIsTagDropdownReady(true);
    }, [openedTagPickerProjectId, applyDropdownPlacement]);

    useLayoutEffect(() => {
        if (!openedTagPickerProjectId) {
            return;
        }
        // Recalculate before paint to avoid intermediate wrong placement flash.
        recalculateDropdownPlacement();
    }, [
        openedTagPickerProjectId,
        projectTags,
        newTagByProject,
        recalculateDropdownPlacement,
    ]);

    useEffect(() => {
        if (!openedTagPickerProjectId) {
            return;
        }
        const updatePlacement = () => recalculateDropdownPlacement();
        const viewport = window.visualViewport;
        const resizeObserver =
            typeof ResizeObserver !== 'undefined'
                ? new ResizeObserver(updatePlacement)
                : null;
        if (resizeObserver) {
            resizeObserver.observe(document.documentElement);
        }
        window.addEventListener('resize', updatePlacement);
        window.addEventListener('scroll', updatePlacement, true);
        viewport?.addEventListener('resize', updatePlacement);
        viewport?.addEventListener('scroll', updatePlacement);
        return () => {
            resizeObserver?.disconnect();
            window.removeEventListener('resize', updatePlacement);
            window.removeEventListener('scroll', updatePlacement, true);
            viewport?.removeEventListener('resize', updatePlacement);
            viewport?.removeEventListener('scroll', updatePlacement);
        };
    }, [openedTagPickerProjectId, recalculateDropdownPlacement]);

    const localize = useMemo(() => {
        switch (lang) {
            case 'ru': {
                return ru;
            }
            default: {
                return enGB;
            }
        }
    }, [lang]);

    const onAddProjectClick = useCallback(() => {
        setShowAddModal(true);
    }, [setShowAddModal]);

    const onClickDeleteProject = useCallback(
        (e: React.MouseEvent<HTMLElement, unknown>, project: ProjectShort) => {
            e.stopPropagation();
            setShowDeleteModal(project);
        },
        [setShowDeleteModal]
    );

    const onTagPickerButtonClick = useCallback(
        (e: React.MouseEvent<HTMLElement, unknown>, projectId: string) => {
            e.stopPropagation();
            if (openedTagPickerProjectId === projectId) {
                setIsTagDropdownReady(false);
                setOpenedTagPickerProjectId(null);
                return;
            }
            setShowTagsFilterModal(false);
            const triggerRect = (
                e.currentTarget as HTMLElement
            ).getBoundingClientRect();
            applyDropdownPlacement(triggerRect, 250);
            setIsTagDropdownReady(false);
            setOpenedTagPickerProjectId(projectId);
        },
        [openedTagPickerProjectId, applyDropdownPlacement]
    );

    const onTagInputChange = useCallback((projectId: string, value: string) => {
        setNewTagByProject((prev) => ({
            ...prev,
            [projectId]: value,
        }));
    }, []);

    const setTagsForProject = useCallback(
        (projectId: string, tags: string[]) => {
            setProjectTags((prev) => ({
                ...prev,
                [projectId]: tags,
            }));
        },
        []
    );

    const addTagToProject = useCallback(
        (projectId: string, tag: string) => {
            if (!projectId) {
                return;
            }
            const updatedTags = projectTagsService.addTagToProject(
                projectId,
                tag
            );
            setTagsForProject(projectId, updatedTags);
            setNewTagByProject((prev) => ({
                ...prev,
                [projectId]: '',
            }));
        },
        [projectTagsService, setTagsForProject]
    );

    const toggleTagForProject = useCallback(
        (projectId: string, tag: string) => {
            const selectedTags = projectTags[projectId] ?? [];
            const alreadySelected = selectedTags.some(
                (selectedTag) =>
                    selectedTag.toLocaleLowerCase() === tag.toLocaleLowerCase()
            );
            const updatedTags = alreadySelected
                ? projectTagsService.removeTagFromProject(projectId, tag)
                : projectTagsService.addTagToProject(projectId, tag);
            setTagsForProject(projectId, updatedTags);
        },
        [projectTags, projectTagsService, setTagsForProject]
    );

    const allAvailableTags = useMemo(() => {
        const unique = new Map<string, string>();
        Object.values(projectTags)
            .flat()
            .forEach((tag) => {
                const key = tag.toLocaleLowerCase();
                if (!unique.has(key)) {
                    unique.set(key, tag);
                }
            });
        return Array.from(unique.values()).sort((a, b) =>
            tagsCollator.compare(a, b)
        );
    }, [projectTags, tagsCollator]);

    useEffect(() => {
        const availableSet = new Set(
            allAvailableTags.map((tag) => tag.toLocaleLowerCase())
        );
        setSelectedFilterTags((prev) =>
            prev.filter((tag) => availableSet.has(tag.toLocaleLowerCase()))
        );
    }, [allAvailableTags]);

    const sortedProjects = useMemo(() => {
        const toTimestamp = (value?: string) => {
            if (!value) {
                return 0;
            }
            const timestamp = new Date(value).getTime();
            return Number.isNaN(timestamp) ? 0 : timestamp;
        };
        const titleCollator = new Intl.Collator(['en', 'ru'], {
            sensitivity: 'base',
            numeric: true,
        });
        const byTimeDesc = (a: ProjectShort, b: ProjectShort) =>
            toTimestamp(b.lastModified) - toTimestamp(a.lastModified);
        const byTimeAsc = (a: ProjectShort, b: ProjectShort) =>
            toTimestamp(a.lastModified) - toTimestamp(b.lastModified);
        const byTitleAsc = (a: ProjectShort, b: ProjectShort) =>
            titleCollator.compare(a.title ?? '', b.title ?? '');
        const byTitleDesc = (a: ProjectShort, b: ProjectShort) =>
            titleCollator.compare(b.title ?? '', a.title ?? '');

        const projectsCopy = [...projects];
        if (sortMode === 'title') {
            return projectsCopy.sort(
                sortDirection === 'asc' ? byTitleAsc : byTitleDesc
            );
        }
        return projectsCopy.sort(
            sortDirection === 'asc' ? byTimeAsc : byTimeDesc
        );
    }, [projects, sortMode, sortDirection]);

    const filteredProjects = useMemo(() => {
        if (!selectedFilterTags.length) {
            return sortedProjects;
        }
        const selectedSet = new Set(
            selectedFilterTags.map((tag) => tag.toLocaleLowerCase())
        );
        return sortedProjects.filter((project) => {
            const projectTagSet = new Set(
                (projectTags[project.projectId] ?? []).map((tag) =>
                    tag.toLocaleLowerCase()
                )
            );
            return Array.from(selectedSet).every((tag) =>
                projectTagSet.has(tag)
            );
        });
    }, [selectedFilterTags, sortedProjects, projectTags]);

    return (
        <>
            <div className="projects-container">
                <div className="project-content-container">
                    <div className="projects-page-header">
                        <Typography
                            type="h1"
                            text={dictionary.projects.label}
                            color={colors.black}
                        />
                        <div className="projects-filter-controls">
                            <div className="projects-selected-filter-tags">
                                {selectedFilterTags.map((tag) => (
                                    <span
                                        className="projects-selected-filter-chip"
                                        key={`selected-filter-tag-${tag}`}
                                        title={tag}
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                            <div
                                className="projects-filter-anchor"
                                ref={tagsFilterAnchorRef}
                            >
                                <button
                                    className="projects-filter-button"
                                    type="button"
                                    onClick={() =>
                                        setShowTagsFilterModal((prev) => !prev)
                                    }
                                >
                                    {dictionary.projects.tags.filter_open}
                                    {selectedFilterTags.length
                                        ? ` (${selectedFilterTags.length})`
                                        : ''}
                                </button>
                                {showTagsFilterModal ? (
                                    <div className="project-tags-filter-dropdown">
                                        <Typography
                                            color={colors.black}
                                            text={
                                                dictionary.projects.tags
                                                    .filter_title
                                            }
                                            type="body-large"
                                        />
                                        <div className="project-tags-filter-list">
                                            {allAvailableTags.length ? (
                                                allAvailableTags.map((tag) => {
                                                    const selected =
                                                        selectedFilterTags.some(
                                                            (selectedTag) =>
                                                                selectedTag.toLocaleLowerCase() ===
                                                                tag.toLocaleLowerCase()
                                                        );
                                                    return (
                                                        <button
                                                            key={`filter-tag-${tag}`}
                                                            className="project-tags-filter-option"
                                                            data-selected={
                                                                selected
                                                            }
                                                            onClick={() =>
                                                                setSelectedFilterTags(
                                                                    (prev) =>
                                                                        selected
                                                                            ? prev.filter(
                                                                                  (
                                                                                      item
                                                                                  ) =>
                                                                                      item.toLocaleLowerCase() !==
                                                                                      tag.toLocaleLowerCase()
                                                                              )
                                                                            : [
                                                                                  ...prev,
                                                                                  tag,
                                                                              ]
                                                                )
                                                            }
                                                            type="button"
                                                        >
                                                            <span>{tag}</span>
                                                            {selected ? (
                                                                <CheckIcon />
                                                            ) : null}
                                                        </button>
                                                    );
                                                })
                                            ) : (
                                                <Typography
                                                    color={colors.gray30}
                                                    text={
                                                        dictionary.projects.tags
                                                            .filter_empty
                                                    }
                                                    type="body-large"
                                                />
                                            )}
                                        </div>
                                        <div className="project-tags-filter-actions">
                                            <button
                                                className="projects-filter-clear-button"
                                                type="button"
                                                onClick={() =>
                                                    setSelectedFilterTags([])
                                                }
                                            >
                                                {
                                                    dictionary.projects.tags
                                                        .filter_clear
                                                }
                                            </button>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                    {getProjectsRequestState === 'loading' ? (
                        <div className="projects-loading-wrapper" aria-hidden>
                            <span className="projects-loading-spinner" />
                        </div>
                    ) : getProjectsRequestState !== 'ok' &&
                      getProjectsRequestState !== 'unknown' &&
                      !projects.length ? (
                        <div className="projects-loading-wrapper" aria-hidden>
                            <div className="projects-loading-icon-with-text">
                                <span className="projects-loading-warning" />
                                <div className="projects-loading-caption">
                                    {(() => {
                                        switch (getProjectsRequestState) {
                                            case 'unauth': {
                                                const projectsDictAny =
                                                    dictionary.projects as unknown as {
                                                        errors: Record<
                                                            string,
                                                            string
                                                        >;
                                                    };
                                                return (
                                                    projectsDictAny.errors
                                                        ?.sessionExpiredReload ??
                                                    dictionary.filemanager
                                                        .errors.sessionExpired
                                                );
                                            }
                                            default:
                                                return dictionary.filemanager
                                                    .errors.internalError;
                                        }
                                    })()}
                                </div>
                            </div>
                        </div>
                    ) : !projects.length ? (
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                flex: 1,
                            }}
                        >
                            <Button
                                classname="add-project-button"
                                rounded
                                color="gray"
                                title={dictionary.projects.add}
                                minimize={false}
                                titleIcon={() => <PlusIcon />}
                                onPress={onAddProjectClick}
                            />
                        </div>
                    ) : (
                        <div
                            ref={projectsScrollContainerRef}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                flex: 1,
                                overflow: 'auto',
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    flex: 1,
                                }}
                            >
                                <table style={{ marginTop: 30 }}>
                                    <tr>
                                        <th>
                                            <div className="projects-header-cell">
                                                <Typography
                                                    color={colors.gray30}
                                                    text={
                                                        dictionary.projects
                                                            .title
                                                    }
                                                />
                                                <button
                                                    className="projects-sort-icon-button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSortMode('title');
                                                        setSortDirection('asc');
                                                    }}
                                                    type="button"
                                                    aria-label={
                                                        dictionary.projects
                                                            .title
                                                    }
                                                >
                                                    <span
                                                        className={`sort-arrow ${
                                                            sortMode ===
                                                                'title' &&
                                                            sortDirection ===
                                                                'asc'
                                                                ? 'is-active'
                                                                : ''
                                                        }`}
                                                    >
                                                        ▲
                                                    </span>
                                                </button>
                                                <button
                                                    className="projects-sort-icon-button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSortMode('title');
                                                        setSortDirection(
                                                            'desc'
                                                        );
                                                    }}
                                                    type="button"
                                                    aria-label={
                                                        dictionary.projects
                                                            .title
                                                    }
                                                >
                                                    <span
                                                        className={`sort-arrow ${
                                                            sortMode ===
                                                                'title' &&
                                                            sortDirection ===
                                                                'desc'
                                                                ? 'is-active'
                                                                : ''
                                                        }`}
                                                    >
                                                        ▼
                                                    </span>
                                                </button>
                                            </div>
                                        </th>
                                        <th>
                                            <div className="projects-header-cell">
                                                <Typography
                                                    color={colors.gray30}
                                                    text={
                                                        dictionary.projects
                                                            .last_modified
                                                    }
                                                />
                                                <button
                                                    className="projects-sort-icon-button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSortMode('time');
                                                        setSortDirection('asc');
                                                    }}
                                                    type="button"
                                                    aria-label={
                                                        dictionary.projects
                                                            .last_modified
                                                    }
                                                >
                                                    <span
                                                        className={`sort-arrow ${
                                                            sortMode ===
                                                                'time' &&
                                                            sortDirection ===
                                                                'asc'
                                                                ? 'is-active'
                                                                : ''
                                                        }`}
                                                    >
                                                        ▲
                                                    </span>
                                                </button>
                                                <button
                                                    className="projects-sort-icon-button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSortMode('time');
                                                        setSortDirection(
                                                            'desc'
                                                        );
                                                    }}
                                                    type="button"
                                                    aria-label={
                                                        dictionary.projects
                                                            .last_modified
                                                    }
                                                >
                                                    <span
                                                        className={`sort-arrow ${
                                                            sortMode ===
                                                                'time' &&
                                                            sortDirection ===
                                                                'desc'
                                                                ? 'is-active'
                                                                : ''
                                                        }`}
                                                    >
                                                        ▼
                                                    </span>
                                                </button>
                                            </div>
                                        </th>
                                        <th>
                                            <Typography
                                                color={colors.gray30}
                                                text={
                                                    dictionary.projects.tags
                                                        .column
                                                }
                                            />
                                        </th>
                                        <th></th>
                                    </tr>
                                    {filteredProjects.map((p) => (
                                        <tr
                                            onClick={() => {
                                                setShowTagsFilterModal(false);
                                                setOpenedTagPickerProjectId(
                                                    null
                                                );
                                                if (p.projectId) {
                                                    dispatch(
                                                        controller.onRowClickedInProjectsListRequest(
                                                            {
                                                                projectId:
                                                                    p.projectId,
                                                            }
                                                        )
                                                    );
                                                }
                                            }}
                                            key={`${p.projectId}-${p.title}`}
                                        >
                                            {(() => {
                                                const allTags =
                                                    allAvailableTags;
                                                const selectedTagsSet = new Set(
                                                    (
                                                        projectTags[
                                                            p.projectId
                                                        ] ?? []
                                                    ).map((tag) =>
                                                        tag.toLocaleLowerCase()
                                                    )
                                                );
                                                return (
                                                    <>
                                                        <td
                                                            style={{
                                                                height: 63,
                                                            }}
                                                        >
                                                            <ProjectTitle
                                                                project={p}
                                                            />
                                                        </td>
                                                        <td>
                                                            <Typography
                                                                color={
                                                                    colors.gray30
                                                                }
                                                                text={formatDistance(
                                                                    new Date(),
                                                                    new Date(
                                                                        p.lastModified!
                                                                    ),
                                                                    {
                                                                        locale: localize,
                                                                    }
                                                                )}
                                                                type="body-large"
                                                            />
                                                        </td>
                                                        <td>
                                                            <div
                                                                className={`project-tags-cell ${
                                                                    singleLineTagsByProject[
                                                                        p
                                                                            .projectId
                                                                    ]
                                                                        ? 'single-line'
                                                                        : ''
                                                                }`}
                                                                ref={(
                                                                    element
                                                                ) => {
                                                                    projectTagsCellRefs.current[
                                                                        p.projectId
                                                                    ] = element;
                                                                }}
                                                            >
                                                                {(
                                                                    projectTags[
                                                                        p
                                                                            .projectId
                                                                    ] ?? []
                                                                ).length ? (
                                                                    (
                                                                        projectTags[
                                                                            p
                                                                                .projectId
                                                                        ] ?? []
                                                                    ).map(
                                                                        (
                                                                            tag
                                                                        ) => (
                                                                            <span
                                                                                className="project-tag-chip"
                                                                                key={`${p.projectId}-${tag}`}
                                                                                title={
                                                                                    tag
                                                                                }
                                                                            >
                                                                                {
                                                                                    tag
                                                                                }
                                                                            </span>
                                                                        )
                                                                    )
                                                                ) : (
                                                                    <Typography
                                                                        color={
                                                                            colors.gray30
                                                                        }
                                                                        text="—"
                                                                        type="body-large"
                                                                    />
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div className="project-actions-container">
                                                                <div className="project-tags-anchor">
                                                                    <button
                                                                        type="button"
                                                                        ref={(
                                                                            element
                                                                        ) => {
                                                                            tagButtonRefs.current[
                                                                                p.projectId
                                                                            ] =
                                                                                element;
                                                                        }}
                                                                        onClick={(
                                                                            e
                                                                        ) =>
                                                                            onTagPickerButtonClick(
                                                                                e,
                                                                                p.projectId
                                                                            )
                                                                        }
                                                                        className="project-tags-button"
                                                                    >
                                                                        {
                                                                            dictionary
                                                                                .projects
                                                                                .tags
                                                                                .add
                                                                        }
                                                                    </button>
                                                                    {openedTagPickerProjectId ===
                                                                    p.projectId ? (
                                                                        <div
                                                                            ref={
                                                                                openedDropdownRef
                                                                            }
                                                                            className={`project-tags-dropdown ${
                                                                                tagDropdownPlacement ===
                                                                                'top'
                                                                                    ? 'open-up'
                                                                                    : 'open-down'
                                                                            }`}
                                                                            style={{
                                                                                visibility:
                                                                                    isTagDropdownReady
                                                                                        ? 'visible'
                                                                                        : 'hidden',
                                                                            }}
                                                                            onClick={(
                                                                                e
                                                                            ) =>
                                                                                e.stopPropagation()
                                                                            }
                                                                        >
                                                                            <div className="project-tags-dropdown-header">
                                                                                <Typography
                                                                                    className="project-tags-hint"
                                                                                    color={
                                                                                        colors.gray30
                                                                                    }
                                                                                    type="body-large"
                                                                                    text={
                                                                                        dictionary
                                                                                            .projects
                                                                                            .tags
                                                                                            .hint
                                                                                    }
                                                                                />
                                                                                <button
                                                                                    type="button"
                                                                                    className="project-tags-close-button"
                                                                                    onClick={(
                                                                                        e
                                                                                    ) => {
                                                                                        e.stopPropagation();
                                                                                        setOpenedTagPickerProjectId(
                                                                                            null
                                                                                        );
                                                                                    }}
                                                                                    aria-label="Close tags list"
                                                                                >
                                                                                    <CloseIcon />
                                                                                </button>
                                                                            </div>
                                                                            <div className="project-tags-scroll">
                                                                                {allTags.length ? (
                                                                                    allTags.map(
                                                                                        (
                                                                                            tag
                                                                                        ) => (
                                                                                            <button
                                                                                                key={`${p.projectId}-${tag}-available`}
                                                                                                type="button"
                                                                                                className="project-tag-option"
                                                                                                data-selected={selectedTagsSet.has(
                                                                                                    tag.toLocaleLowerCase()
                                                                                                )}
                                                                                                onClick={(
                                                                                                    e
                                                                                                ) => {
                                                                                                    e.stopPropagation();
                                                                                                    toggleTagForProject(
                                                                                                        p.projectId,
                                                                                                        tag
                                                                                                    );
                                                                                                }}
                                                                                            >
                                                                                                <span>
                                                                                                    {
                                                                                                        tag
                                                                                                    }
                                                                                                </span>
                                                                                                {selectedTagsSet.has(
                                                                                                    tag.toLocaleLowerCase()
                                                                                                ) ? (
                                                                                                    <span className="project-tag-option-check">
                                                                                                        <CheckIcon />
                                                                                                    </span>
                                                                                                ) : null}
                                                                                            </button>
                                                                                        )
                                                                                    )
                                                                                ) : (
                                                                                    <Typography
                                                                                        color={
                                                                                            colors.gray30
                                                                                        }
                                                                                        type="body-large"
                                                                                        text={
                                                                                            dictionary
                                                                                                .projects
                                                                                                .tags
                                                                                                .empty
                                                                                        }
                                                                                    />
                                                                                )}
                                                                            </div>
                                                                            <div className="project-tags-input-row">
                                                                                <input
                                                                                    value={
                                                                                        newTagByProject[
                                                                                            p
                                                                                                .projectId
                                                                                        ] ??
                                                                                        ''
                                                                                    }
                                                                                    onChange={(
                                                                                        e
                                                                                    ) =>
                                                                                        onTagInputChange(
                                                                                            p.projectId,
                                                                                            e
                                                                                                .target
                                                                                                .value
                                                                                        )
                                                                                    }
                                                                                    onClick={(
                                                                                        e
                                                                                    ) =>
                                                                                        e.stopPropagation()
                                                                                    }
                                                                                    onKeyDown={(
                                                                                        e
                                                                                    ) => {
                                                                                        if (
                                                                                            e.key ===
                                                                                            'Enter'
                                                                                        ) {
                                                                                            e.stopPropagation();
                                                                                            addTagToProject(
                                                                                                p.projectId,
                                                                                                newTagByProject[
                                                                                                    p
                                                                                                        .projectId
                                                                                                ] ??
                                                                                                    ''
                                                                                            );
                                                                                        }
                                                                                    }}
                                                                                    className="project-tags-input"
                                                                                    placeholder={
                                                                                        dictionary
                                                                                            .projects
                                                                                            .tags
                                                                                            .new_placeholder
                                                                                    }
                                                                                />
                                                                                <button
                                                                                    type="button"
                                                                                    className="project-tags-add-button"
                                                                                    onClick={(
                                                                                        e
                                                                                    ) => {
                                                                                        e.stopPropagation();
                                                                                        addTagToProject(
                                                                                            p.projectId,
                                                                                            newTagByProject[
                                                                                                p
                                                                                                    .projectId
                                                                                            ] ??
                                                                                                ''
                                                                                        );
                                                                                    }}
                                                                                    aria-label={
                                                                                        dictionary
                                                                                            .projects
                                                                                            .tags
                                                                                            .add_new
                                                                                    }
                                                                                >
                                                                                    <PlusIcon />
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    ) : null}
                                                                </div>
                                                                <div
                                                                    onClick={(
                                                                        e
                                                                    ) =>
                                                                        onClickDeleteProject(
                                                                            e,
                                                                            p
                                                                        )
                                                                    }
                                                                    className="delete-project-container"
                                                                >
                                                                    <div className="delete-icon">
                                                                        <PlusIcon />
                                                                    </div>
                                                                    <Typography
                                                                        color={
                                                                            colors.black
                                                                        }
                                                                        text={
                                                                            dictionary.delete
                                                                        }
                                                                    />
                                                                    <div
                                                                        style={{
                                                                            width: 10,
                                                                        }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </>
                                                );
                                            })()}
                                        </tr>
                                    ))}
                                </table>
                            </div>
                        </div>
                    )}
                    {projects.length ? (
                        <Button
                            classname="add-project-button-footer"
                            rounded
                            color="gray"
                            title={dictionary.projects.add}
                            minimize={false}
                            titleIcon={() => <PlusIcon />}
                            onPress={onAddProjectClick}
                        />
                    ) : null}
                </div>
            </div>
            <Modal
                onClose={() => setShowAddModal(false)}
                showModal={showAddModal}
            >
                <AddProjectModal onClose={() => setShowAddModal(false)} />
            </Modal>
            <Modal
                onClose={() => setShowDeleteModal(false)}
                showModal={!!showDeleteModal}
            >
                <DeleteProjectModal
                    onClose={() => setShowDeleteModal(false)}
                    projectId={(showDeleteModal as ProjectShort).projectId!}
                    projectName={(showDeleteModal as ProjectShort).title!}
                />
            </Modal>
        </>
    );
};
