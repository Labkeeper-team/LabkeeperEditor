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
import {
    useProjectTagsByProject,
    useProjects,
} from '../../store/selectors/program';
import { colors } from '../../styles/colors';
import {
    useCurrentLanguage,
    useDictionary,
} from '../../store/selectors/translations';
import { AppDispatch, StorageState } from '../../store';
import { controller } from '../../../main.tsx';

type SortMode = 'time' | 'title';
type SortDirection = 'asc' | 'desc';
type TagDropdownPlacement = 'top' | 'bottom';
type TagInfo = { label: string; color: string };
const DEFAULT_NEW_TAG_COLOR = 'blue';
const TAG_COLOR_SWATCHES = [
    'blue',
    'orange',
    'red',
    'purple',
    'cyan',
    'lime',
    'deeppink',
    'deepskyblue',
    'darkorange',
    'green',
    'violet',
    'teal',
    'yellow',
    'indigo',
    'pink',
    'olive',
];

export const ProjectsPage = () => {
    const [showAddModal, setShowAddModal] = useState(false);
    const [showTagsFilterModal, setShowTagsFilterModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState<
        false | ProjectShort
    >(false);
    const [sortMode, setSortMode] = useState<SortMode>('time');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [openedTagPickerProjectId, setOpenedTagPickerProjectId] = useState<
        string | null
    >(null);
    const [tagDropdownPlacement, setTagDropdownPlacement] =
        useState<TagDropdownPlacement>('bottom');
    const [isTagDropdownReady, setIsTagDropdownReady] = useState(false);
    const [newTagByProject, setNewTagByProject] = useState<
        Record<string, string>
    >({});
    const [nextTagColor, setNextTagColor] = useState<string>(
        DEFAULT_NEW_TAG_COLOR
    );
    const [nextTagColorInput, setNextTagColorInput] = useState<string>(
        DEFAULT_NEW_TAG_COLOR
    );
    const [openedColorPaletteProjectId, setOpenedColorPaletteProjectId] =
        useState<string | null>(null);
    const [selectedFilterTagKeys, setSelectedFilterTagKeys] = useState<
        string[]
    >([]);
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
    const projectTagsByProject = useSelector(useProjectTagsByProject);
    const getProjectsRequestState = useSelector(
        (state: StorageState) => state.ide.getProjectsRequestState
    );
    const dispatch = useDispatch<AppDispatch>();
    const tagsCollator = useMemo(
        () =>
            new Intl.Collator(['en', 'ru'], {
                sensitivity: 'base',
                numeric: true,
            }),
        []
    );
    const normalizeColorInput = useCallback((value: string): string | null => {
        const prepared = value.trim();
        if (!prepared) {
            return null;
        }
        if (typeof window !== 'undefined' && window.CSS?.supports) {
            if (!window.CSS.supports('color', prepared)) {
                return null;
            }
        }
        return prepared;
    }, []);
    const normalizeTagLabel = useCallback(
        (value: string) => value.trim().replace(/\s+/g, ' '),
        []
    );
    const {
        tagMap,
        projectTagKeysByProject,
    }: {
        tagMap: Record<string, TagInfo>;
        projectTagKeysByProject: Record<string, string[]>;
    } = useMemo(() => {
        const nextTagMap: Record<string, TagInfo> = {};
        const nextProjectTagKeysByProject: Record<string, string[]> = {};

        for (const [projectId, tags] of Object.entries(projectTagsByProject)) {
            const projectTagKeys = new Set<string>();
            for (const [rawLabel, rawColor] of Object.entries(tags ?? {})) {
                const label = normalizeTagLabel(rawLabel);
                const color =
                    normalizeColorInput(rawColor) ?? DEFAULT_NEW_TAG_COLOR;
                if (!label) {
                    continue;
                }
                const key = label.toLocaleLowerCase();
                projectTagKeys.add(key);
                if (!nextTagMap[key]) {
                    nextTagMap[key] = { label, color };
                }
            }
            nextProjectTagKeysByProject[projectId] = Array.from(projectTagKeys);
        }

        return {
            tagMap: nextTagMap,
            projectTagKeysByProject: nextProjectTagKeysByProject,
        };
    }, [normalizeColorInput, normalizeTagLabel, projectTagsByProject]);
    const getTagColor = useCallback(
        (tag: string) =>
            tagMap[tag.toLocaleLowerCase()]?.color ?? DEFAULT_NEW_TAG_COLOR,
        [tagMap]
    );
    const getNextSuggestedTagColor = useCallback(
        (knownColors: string[], currentColor?: string) => {
            const normalizedKnown = new Set(
                knownColors.map((color) => color.toLocaleLowerCase())
            );
            const paletteSize = TAG_COLOR_SWATCHES.length;
            const currentIndex = currentColor
                ? TAG_COLOR_SWATCHES.findIndex(
                      (color) =>
                          color.toLocaleLowerCase() ===
                          currentColor.toLocaleLowerCase()
                  )
                : -1;

            for (let step = 1; step <= paletteSize; step += 1) {
                const index = (currentIndex + step) % paletteSize;
                const candidate = TAG_COLOR_SWATCHES[index];
                if (!normalizedKnown.has(candidate.toLocaleLowerCase())) {
                    return candidate;
                }
            }

            return TAG_COLOR_SWATCHES[(currentIndex + 1) % paletteSize];
        },
        []
    );

    useEffect(() => {
        Object.values(projectTagsCellRefs.current).forEach((cell) => {
            if (cell) {
                cell.scrollTop = 0;
            }
        });
    }, [projectTagKeysByProject]);

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
    }, [projectTagKeysByProject, projects, recalculateTagsRowsLayout]);

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
        setOpenedColorPaletteProjectId(null);
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
        projectTagKeysByProject,
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
                setOpenedColorPaletteProjectId(null);
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

    const onNewTagColorChange = useCallback(
        (_projectId: string, value: string) => {
            const normalized = normalizeColorInput(value);
            if (!normalized) {
                return;
            }
            setNextTagColor(normalized);
            setNextTagColorInput(normalized);
        },
        [normalizeColorInput]
    );

    const onColorPaletteToggle = useCallback((projectId: string) => {
        setOpenedColorPaletteProjectId((prev) =>
            prev === projectId ? null : projectId
        );
    }, []);

    const onNewTagColorInputChange = useCallback(
        (_projectId: string, value: string) => {
            setNextTagColorInput(value);
        },
        []
    );

    const commitNewTagColorInput = useCallback(() => {
        const rawValue = nextTagColorInput ?? '';
        const normalized = normalizeColorInput(rawValue);
        if (!normalized) {
            setNextTagColorInput(nextTagColor ?? DEFAULT_NEW_TAG_COLOR);
            return;
        }
        setNextTagColor(normalized);
        setNextTagColorInput(normalized);
    }, [nextTagColor, nextTagColorInput, normalizeColorInput]);

    useEffect(() => {
        if (!openedTagPickerProjectId) {
            setOpenedColorPaletteProjectId(null);
        }
    }, [openedTagPickerProjectId]);

    const addTagToProject = useCallback(
        (projectId: string, tag: string) => {
            if (!projectId) {
                return;
            }
            const normalizedTag = normalizeTagLabel(tag);
            if (!normalizedTag) {
                return;
            }
            const tagKey = normalizedTag.toLocaleLowerCase();
            const existingColor = normalizedTag
                ? tagMap[tagKey]?.color
                : undefined;
            const fromInput = normalizeColorInput(nextTagColorInput ?? '');
            const chosenColor =
                existingColor ??
                fromInput ??
                nextTagColor ??
                DEFAULT_NEW_TAG_COLOR;
            dispatch(
                controller.onAddTagToProjectRequest({
                    projectId,
                    tagLabel: normalizedTag,
                    color: chosenColor,
                })
            );
            setNewTagByProject((prev) => ({
                ...prev,
                [projectId]: '',
            }));
            const nextSuggestedColor = getNextSuggestedTagColor(
                [
                    ...Object.values(tagMap).map((tagInfo) => tagInfo.color),
                    chosenColor,
                ],
                chosenColor
            );
            setNextTagColor(nextSuggestedColor);
            setNextTagColorInput(nextSuggestedColor);
        },
        [
            dispatch,
            getNextSuggestedTagColor,
            normalizeColorInput,
            normalizeTagLabel,
            nextTagColor,
            nextTagColorInput,
            tagMap,
        ]
    );

    const toggleTagForProject = useCallback(
        (projectId: string, tagKey: string) => {
            const selectedTagKeys = projectTagKeysByProject[projectId] ?? [];
            const alreadySelected = selectedTagKeys.includes(tagKey);
            if (alreadySelected) {
                dispatch(
                    controller.onRemoveTagFromProjectRequest({
                        projectId,
                        tagLabel: tagMap[tagKey]?.label ?? tagKey,
                    })
                );
                return;
            }
            dispatch(
                controller.onAddTagToProjectRequest({
                    projectId,
                    tagLabel: tagMap[tagKey]?.label ?? tagKey,
                    color: tagMap[tagKey]?.color ?? DEFAULT_NEW_TAG_COLOR,
                })
            );
        },
        [dispatch, projectTagKeysByProject, tagMap]
    );

    const allAvailableTagKeys = useMemo(
        () =>
            Object.keys(tagMap).sort((a, b) =>
                tagsCollator.compare(
                    tagMap[a]?.label ?? a,
                    tagMap[b]?.label ?? b
                )
            ),
        [tagMap, tagsCollator]
    );

    useEffect(() => {
        const availableSet = new Set(allAvailableTagKeys);
        setSelectedFilterTagKeys((prev) =>
            prev.filter((tagKey) => availableSet.has(tagKey))
        );
    }, [allAvailableTagKeys]);

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
        if (!selectedFilterTagKeys.length) {
            return sortedProjects;
        }
        const selectedSet = new Set(selectedFilterTagKeys);
        return sortedProjects.filter((project) => {
            const projectTagSet = new Set(
                projectTagKeysByProject[project.projectId] ?? []
            );
            return Array.from(selectedSet).every((tagKey) =>
                projectTagSet.has(tagKey)
            );
        });
    }, [projectTagKeysByProject, selectedFilterTagKeys, sortedProjects]);

    const sortedFilterTagKeys = useMemo(() => {
        const selectedSet = new Set(selectedFilterTagKeys);
        const selected = allAvailableTagKeys.filter((tagKey) =>
            selectedSet.has(tagKey)
        );
        const unselected = allAvailableTagKeys.filter(
            (tagKey) => !selectedSet.has(tagKey)
        );
        return [...selected, ...unselected];
    }, [allAvailableTagKeys, selectedFilterTagKeys]);

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
                                {selectedFilterTagKeys.map((tagKey) => (
                                    <span
                                        className="projects-selected-filter-chip"
                                        key={`selected-filter-tag-${tagKey}`}
                                        title={tagMap[tagKey]?.label ?? tagKey}
                                    >
                                        <span
                                            className="tag-color-dot"
                                            style={{
                                                backgroundColor:
                                                    getTagColor(tagKey),
                                            }}
                                        />
                                        <span className="tag-label">
                                            {tagMap[tagKey]?.label ?? tagKey}
                                        </span>
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
                                    {selectedFilterTagKeys.length
                                        ? ` (${selectedFilterTagKeys.length})`
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
                                            {sortedFilterTagKeys.length ? (
                                                sortedFilterTagKeys.map(
                                                    (tagKey) => {
                                                        const selected =
                                                            selectedFilterTagKeys.includes(
                                                                tagKey
                                                            );
                                                        return (
                                                            <button
                                                                key={`filter-tag-${tagKey}`}
                                                                className="project-tags-filter-option"
                                                                data-selected={
                                                                    selected
                                                                }
                                                                onClick={() =>
                                                                    setSelectedFilterTagKeys(
                                                                        (
                                                                            prev
                                                                        ) =>
                                                                            selected
                                                                                ? prev.filter(
                                                                                      (
                                                                                          item
                                                                                      ) =>
                                                                                          item !==
                                                                                          tagKey
                                                                                  )
                                                                                : [
                                                                                      ...prev,
                                                                                      tagKey,
                                                                                  ]
                                                                    )
                                                                }
                                                                type="button"
                                                            >
                                                                <span className="tag-option-main">
                                                                    <span
                                                                        className="tag-color-dot"
                                                                        style={{
                                                                            backgroundColor:
                                                                                getTagColor(
                                                                                    tagKey
                                                                                ),
                                                                        }}
                                                                    />
                                                                    <span className="tag-label">
                                                                        {tagMap[
                                                                            tagKey
                                                                        ]
                                                                            ?.label ??
                                                                            tagKey}
                                                                    </span>
                                                                </span>
                                                                {selected ? (
                                                                    <CheckIcon />
                                                                ) : null}
                                                            </button>
                                                        );
                                                    }
                                                )
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
                                                    setSelectedFilterTagKeys([])
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
                                                const allTagKeys =
                                                    allAvailableTagKeys;
                                                const selectedTagsSet = new Set(
                                                    projectTagKeysByProject[
                                                        p.projectId
                                                    ] ?? []
                                                );
                                                const orderedProjectTags = [
                                                    ...allTagKeys.filter(
                                                        (tagKey) =>
                                                            selectedTagsSet.has(
                                                                tagKey
                                                            )
                                                    ),
                                                    ...allTagKeys.filter(
                                                        (tagKey) =>
                                                            !selectedTagsSet.has(
                                                                tagKey
                                                            )
                                                    ),
                                                ];
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
                                                                    projectTagKeysByProject[
                                                                        p
                                                                            .projectId
                                                                    ] ?? []
                                                                ).length ? (
                                                                    (
                                                                        projectTagKeysByProject[
                                                                            p
                                                                                .projectId
                                                                        ] ?? []
                                                                    ).map(
                                                                        (
                                                                            tagKey
                                                                        ) => (
                                                                            <span
                                                                                className="project-tag-chip"
                                                                                key={`${p.projectId}-${tagKey}`}
                                                                                title={
                                                                                    tagMap[
                                                                                        tagKey
                                                                                    ]
                                                                                        ?.label ??
                                                                                    tagKey
                                                                                }
                                                                            >
                                                                                <span
                                                                                    className="tag-color-dot"
                                                                                    style={{
                                                                                        backgroundColor:
                                                                                            getTagColor(
                                                                                                tagKey
                                                                                            ),
                                                                                    }}
                                                                                />
                                                                                <span className="tag-label">
                                                                                    {tagMap[
                                                                                        tagKey
                                                                                    ]
                                                                                        ?.label ??
                                                                                        tagKey}
                                                                                </span>
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
                                                                                {orderedProjectTags.length ? (
                                                                                    orderedProjectTags.map(
                                                                                        (
                                                                                            tagKey
                                                                                        ) => (
                                                                                            <button
                                                                                                key={`${p.projectId}-${tagKey}-available`}
                                                                                                type="button"
                                                                                                className="project-tag-option"
                                                                                                data-selected={selectedTagsSet.has(
                                                                                                    tagKey
                                                                                                )}
                                                                                                onClick={(
                                                                                                    e
                                                                                                ) => {
                                                                                                    e.stopPropagation();
                                                                                                    toggleTagForProject(
                                                                                                        p.projectId,
                                                                                                        tagKey
                                                                                                    );
                                                                                                }}
                                                                                            >
                                                                                                <span className="tag-option-main">
                                                                                                    <span
                                                                                                        className="tag-color-dot"
                                                                                                        style={{
                                                                                                            backgroundColor:
                                                                                                                getTagColor(
                                                                                                                    tagKey
                                                                                                                ),
                                                                                                        }}
                                                                                                    />
                                                                                                    <span className="tag-label">
                                                                                                        {tagMap[
                                                                                                            tagKey
                                                                                                        ]
                                                                                                            ?.label ??
                                                                                                            tagKey}
                                                                                                    </span>
                                                                                                </span>
                                                                                                {selectedTagsSet.has(
                                                                                                    tagKey
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
                                                                                <div className="project-tags-new-input-actions">
                                                                                    <button
                                                                                        type="button"
                                                                                        className="project-tags-color-picker-button"
                                                                                        onClick={(
                                                                                            e
                                                                                        ) => {
                                                                                            e.stopPropagation();
                                                                                            onColorPaletteToggle(
                                                                                                p.projectId
                                                                                            );
                                                                                        }}
                                                                                        aria-label="Open color palette"
                                                                                    >
                                                                                        <span
                                                                                            className="project-tags-color-preview"
                                                                                            style={{
                                                                                                backgroundColor:
                                                                                                    nextTagColor ??
                                                                                                    DEFAULT_NEW_TAG_COLOR,
                                                                                            }}
                                                                                        />
                                                                                    </button>
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
                                                                                {openedColorPaletteProjectId ===
                                                                                p.projectId ? (
                                                                                    <div
                                                                                        className="project-tags-color-panel"
                                                                                        onClick={(
                                                                                            e
                                                                                        ) =>
                                                                                            e.stopPropagation()
                                                                                        }
                                                                                    >
                                                                                        <div className="project-tags-color-swatch-grid">
                                                                                            {TAG_COLOR_SWATCHES.map(
                                                                                                (
                                                                                                    swatchColor
                                                                                                ) => (
                                                                                                    <button
                                                                                                        key={`swatch-${swatchColor}`}
                                                                                                        type="button"
                                                                                                        className="project-tags-color-swatch"
                                                                                                        style={{
                                                                                                            backgroundColor:
                                                                                                                swatchColor,
                                                                                                        }}
                                                                                                        onClick={() =>
                                                                                                            onNewTagColorChange(
                                                                                                                p.projectId,
                                                                                                                swatchColor
                                                                                                            )
                                                                                                        }
                                                                                                        data-selected={
                                                                                                            (
                                                                                                                nextTagColor ??
                                                                                                                DEFAULT_NEW_TAG_COLOR
                                                                                                            ).toLocaleLowerCase() ===
                                                                                                            swatchColor.toLocaleLowerCase()
                                                                                                        }
                                                                                                        aria-label={`Set tag color ${swatchColor}`}
                                                                                                    />
                                                                                                )
                                                                                            )}
                                                                                        </div>
                                                                                        <input
                                                                                            className="project-tags-color-input-text"
                                                                                            value={
                                                                                                nextTagColorInput ??
                                                                                                nextTagColor ??
                                                                                                DEFAULT_NEW_TAG_COLOR
                                                                                            }
                                                                                            placeholder={
                                                                                                dictionary
                                                                                                    .projects
                                                                                                    .tags
                                                                                                    .color_placeholder
                                                                                            }
                                                                                            onChange={(
                                                                                                e
                                                                                            ) =>
                                                                                                onNewTagColorInputChange(
                                                                                                    p.projectId,
                                                                                                    e
                                                                                                        .target
                                                                                                        .value
                                                                                                )
                                                                                            }
                                                                                            onBlur={() =>
                                                                                                commitNewTagColorInput()
                                                                                            }
                                                                                            onKeyDown={(
                                                                                                e
                                                                                            ) => {
                                                                                                if (
                                                                                                    e.key ===
                                                                                                    'Enter'
                                                                                                ) {
                                                                                                    e.stopPropagation();
                                                                                                    commitNewTagColorInput();
                                                                                                }
                                                                                            }}
                                                                                        />
                                                                                    </div>
                                                                                ) : null}
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
