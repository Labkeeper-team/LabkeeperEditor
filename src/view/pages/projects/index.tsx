import { useDispatch, useSelector } from 'react-redux';
import { format, formatDistanceToNow } from 'date-fns';
import { enGB, ru, zhCN } from 'date-fns/locale';
import React, {
    ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useNavigate } from 'react-router-dom';

import { toast } from 'react-toastify';
import classNames from 'classnames';

import './style.scss';
import { Typography } from '../../components/typography';
import { Button } from '../../components/button';
import { PlusIcon, SearchIcon } from '../../icons';
import { Modal } from '../../components/modal';
import { DeleteProjectModal } from './deleteProjectModal';
import { ProjectShort, ProjectTag } from '../../../model/domain';
import { ProjectTitle } from './projectTitle';
import { useProjects } from '../../store/selectors/program';
import { colors } from '../../styles/colors';
import {
    useCurrentLanguage,
    useDictionary,
} from '../../store/selectors/translations';
import { AppDispatch, StorageState } from '../../store';
import { controller } from '../../../main.tsx';
import { Events } from '../../../model/service/ObserverService.ts';
import { useIsMobile } from '../../hooks/useMobile';
import { Select } from '../../components/select';
import { SegmentedControl } from '../../components/segmentedControl';
import { TruncatedTextTooltip } from '../../components/truncatedTextTooltip';
import { Routes } from '../../../viewModel/routes.ts';
import { TagChip } from './tagChip';
import { TagsModal } from './tagsModal';
import { ProjectAction, ProjectActions } from './projectActions';
import { ProjectsSidebar } from './projectsSidebar';
import { TagEditModal } from './tagEditModal';
import {
    AccessFilter,
    EMPTY_FILTER,
    ProjectsFilter,
    ProjectsSort,
    SortField,
    TypeFilter,
    collectTags,
    defaultDirection,
    isFilterActive,
    loadSort,
    matchesFilter,
    saveSort,
    sortProjects,
    tagKey,
} from './projectsFilter.ts';

const PROJECT_TITLE_TOOLTIP_ID = 'projects-title-tooltip';

const TYPE_LABELS: Record<string, string> = {
    latex: 'LaTeX',
    markdown: 'Markdown',
};

const projectHref = (projectId?: string) =>
    Routes.Project.replace(':id', projectId ?? '');

const toDate = (value?: string): Date | null => {
    if (!value) {
        return null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

export const ProjectsPage = () => {
    const [deleteTarget, setDeleteTarget] = useState<ProjectShort | null>(null);
    const [tagsTargetId, setTagsTargetId] = useState<string | null>(null);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    /**
     * Шло ли переименование, когда человек нажал кнопку мыши. Нажатие мимо
     * поля сначала завершает переименование (blur), и к щелчку renamingId уже
     * пуст; без этой отметки тот же щелчок открыл бы проект
     */
    const pressedWhileRenaming = useRef(false);
    // окно метки из боковой панели: {} создаёт новую, { tag } правит её
    const [tagEdit, setTagEdit] = useState<{ tag?: ProjectTag } | null>(null);
    const [tagToDelete, setTagToDelete] = useState<ProjectTag | null>(null);
    const [sort, setSort] = useState<ProjectsSort>(loadSort);
    const [rawFilter, setFilter] = useState<ProjectsFilter>(EMPTY_FILTER);
    const searchRef = useRef<HTMLInputElement>(null);

    const dictionary = useSelector(useDictionary);
    const texts = dictionary.projects;
    const lang = useSelector(useCurrentLanguage);
    const projects = useSelector(useProjects);
    const getProjectsRequestState = useSelector(
        (state: StorageState) => state.ide.getProjectsRequestState
    );
    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();
    const isMobile = useIsMobile();

    const locale = useMemo(() => {
        switch (lang) {
            case 'ru':
                return ru;
            case 'zh':
                return zhCN;
            default:
                return enGB;
        }
    }, [lang]);

    // китайские названия упорядочиваем по пиньиню, для остальных порядок прежний
    const collator = useMemo(
        () =>
            new Intl.Collator(lang === 'zh' ? ['zh-CN', 'en'] : ['en', 'ru'], {
                sensitivity: 'base',
                numeric: true,
            }),
        [lang]
    );

    const knownTags = useMemo(
        () => collectTags(projects, collator),
        [projects, collator]
    );

    // метку сняли со всех проектов: фильтровать по ней больше нельзя
    const filter = useMemo<ProjectsFilter>(() => {
        const known = knownTags.some(
            (tag) => tagKey(tag.name) === rawFilter.tag
        );
        return known ? rawFilter : { ...rawFilter, tag: null };
    }, [rawFilter, knownTags]);

    const visibleProjects = useMemo(
        () =>
            sortProjects(
                projects.filter((project) => matchesFilter(project, filter)),
                sort,
                collator
            ),
        [projects, filter, sort, collator]
    );

    const typesPresent = useMemo(
        () =>
            new Set(
                projects.map((project) => project.projectType).filter(Boolean)
            ),
        [projects]
    );
    const showTypeFilter = typesPresent.size > 1 || filter.type !== 'all';
    // на компьютере доступ выбирается в боковой панели
    const showAccessFilter =
        isMobile &&
        (projects.some((project) => project.isPublic) ||
            filter.access !== 'all');
    const filterActive = isFilterActive(filter);

    const tagsTarget = tagsTargetId
        ? projects.find((project) => project.projectId === tagsTargetId)
        : undefined;

    const trackFilter = useCallback(
        (kind: string, value: unknown) =>
            controller.trackUiEvent(Events.EVENT_PROJECTS_FILTERED, {
                kind,
                value,
                projects_count: projects.length,
            }),
        [projects.length]
    );

    const updateSort = useCallback(
        (next: ProjectsSort) => {
            setSort(next);
            saveSort(next);
            trackFilter('sort', `${next.field}-${next.direction}`);
        },
        [trackFilter]
    );

    const onSortColumn = useCallback(
        (field: SortField) => {
            updateSort(
                sort.field === field
                    ? {
                          field,
                          direction: sort.direction === 'asc' ? 'desc' : 'asc',
                      }
                    : { field, direction: defaultDirection(field) }
            );
        },
        [sort, updateSort]
    );

    /** Метка выбирается одна, как в Overleaf; null снимает выбор */
    const selectTag = useCallback(
        (key: string | null) => {
            setFilter((current) => ({ ...current, tag: key, untagged: false }));
            trackFilter('tag', key === null ? 'all' : 'tag');
        },
        [trackFilter]
    );

    /** Метка в строке или на телефоне: щелчок по выбранной снимает выбор */
    const toggleTag = useCallback(
        (name: string) => {
            const key = tagKey(name);
            selectTag(filter.tag === key ? null : key);
        },
        [selectTag, filter.tag]
    );

    const selectUntagged = useCallback(() => {
        setFilter((current) => ({
            ...current,
            tag: null,
            untagged: !current.untagged,
        }));
        trackFilter('tag', 'untagged');
    }, [trackFilter]);

    const selectAccess = useCallback(
        (access: AccessFilter) => {
            setFilter((current) => ({ ...current, access }));
            trackFilter('access', access);
        },
        [trackFilter]
    );

    const resetFilters = useCallback(() => {
        setFilter(EMPTY_FILTER);
        trackFilter('reset', null);
    }, [trackFilter]);

    // «/» как на многих сайтах ставит курсор в поиск. Сравниваем символ, а
    // не клавишу: на русской раскладке «/» стоит в другом месте
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (
                e.key !== '/' ||
                e.ctrlKey ||
                e.metaKey ||
                e.altKey ||
                target?.closest('input, textarea, select, [contenteditable]')
            ) {
                return;
            }
            if (searchRef.current) {
                e.preventDefault();
                searchRef.current.focus();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, []);

    const onAddProjectClick = useCallback(() => {
        controller.trackUiEvent(Events.EVENT_CREATE_PROJECT_CLICKED, {
            projects_count: projects.length,
        });
        navigate(Routes.NewProject);
    }, [navigate, projects.length]);

    const openProject = useCallback(
        (projectId?: string) => {
            if (projectId) {
                dispatch(
                    controller.onRowClickedInProjectsListRequest({
                        projectId,
                    })
                );
            }
        },
        [dispatch]
    );

    const openInNewTab = useCallback((projectId: string) => {
        controller.trackUiEvent(Events.EVENT_PROJECT_OPENED, {
            project_id: projectId,
            source: 'list_new_tab',
        });
        window.open(projectHref(projectId), '_blank', 'noopener');
    }, []);

    /**
     * GH-208: проект открывается как обычная ссылка. Ctrl, Cmd и средняя кнопка
     * открывают его в новой вкладке, правая кнопка над названием и датой даёт
     * меню ссылки. Простой щелчок открывает проект без перезагрузки страницы
     */
    const onProjectClick = useCallback(
        (e: React.MouseEvent<HTMLElement>, projectId?: string) => {
            if (!projectId || (e.button !== 0 && e.button !== 1)) {
                return;
            }
            // щелчок, которым закончили переименование, проект не открывает
            if (pressedWhileRenaming.current || renamingId === projectId) {
                pressedWhileRenaming.current = false;
                return;
            }
            const inNewTab = e.button === 1 || e.ctrlKey || e.metaKey;
            if (!inNewTab) {
                e.preventDefault();
                openProject(projectId);
                return;
            }
            // ссылку браузер откроет сам, а мимо неё открываем мы
            const onLink =
                e.target instanceof Element && !!e.target.closest('a[href]');
            if (onLink) {
                controller.trackUiEvent(Events.EVENT_PROJECT_OPENED, {
                    project_id: projectId,
                    source: 'list_new_tab',
                });
            } else {
                openInNewTab(projectId);
            }
        },
        [openProject, openInNewTab, renamingId]
    );

    const copyLink = useCallback(
        (projectId: string) => {
            const url = `${window.location.origin}${projectHref(projectId)}`;
            navigator.clipboard
                .writeText(url)
                .then(() => {
                    controller.trackUiEvent(Events.EVENT_SHARE_LINK_COPIED, {
                        ok: true,
                        source: 'list',
                    });
                    toast(texts.link_copied, { type: 'success' });
                })
                .catch(() => {
                    controller.trackUiEvent(Events.EVENT_SHARE_LINK_COPIED, {
                        ok: false,
                        source: 'list',
                    });
                });
        },
        [texts.link_copied]
    );

    const actionsFor = useCallback(
        (project: ProjectShort): ProjectAction[] => {
            const id = project.projectId;
            const actions: ProjectAction[] = [
                {
                    key: 'open-new-tab',
                    label: texts.actions.open_new_tab,
                    onSelect: () => openInNewTab(id),
                },
                {
                    key: 'rename',
                    label: texts.actions.rename,
                    onSelect: () => setRenamingId(id),
                },
                {
                    key: 'tags',
                    label: texts.actions.edit_tags,
                    onSelect: () => setTagsTargetId(id),
                },
                {
                    key: 'duplicate',
                    label: texts.actions.duplicate,
                    onSelect: () =>
                        dispatch(
                            controller.onDuplicateProjectRequest({
                                projectId: id,
                            })
                        ),
                },
                {
                    key: 'download',
                    label: texts.actions.download,
                    onSelect: () =>
                        dispatch(
                            controller.onDownloadProjectRequest({
                                projectId: id,
                            })
                        ),
                },
                {
                    key: 'visibility',
                    label: project.isPublic
                        ? texts.actions.make_private
                        : texts.actions.make_public,
                    separated: true,
                    onSelect: () =>
                        dispatch(
                            controller.onListedProjectVisibilityChangeRequest({
                                projectId: id,
                                visible: !project.isPublic,
                            })
                        ),
                },
            ];
            if (project.isPublic) {
                actions.push({
                    key: 'copy-link',
                    label: texts.actions.copy_link,
                    onSelect: () => copyLink(id),
                });
            }
            actions.push({
                key: 'delete',
                label: texts.actions.delete,
                danger: true,
                separated: true,
                onSelect: () => setDeleteTarget(project),
            });
            return actions;
        },
        [texts.actions, openInNewTab, dispatch, copyLink]
    );

    const relativeTime = (value?: string) => {
        const date = toDate(value);
        return date
            ? formatDistanceToNow(date, { addSuffix: true, locale })
            : '—';
    };
    const fullTime = (value?: string) => {
        const date = toDate(value);
        return date ? format(date, 'PPp', { locale }) : undefined;
    };

    const typeBadge = (project: ProjectShort) =>
        project.projectType ? (
            <span
                className={classNames(
                    'projects-badge',
                    `projects-badge--${project.projectType}`
                )}
            >
                {TYPE_LABELS[project.projectType] ?? project.projectType}
            </span>
        ) : null;

    const accessBadge = (project: ProjectShort) => (
        <span
            className={classNames('projects-access', {
                'projects-access--public': project.isPublic,
            })}
        >
            <span className="projects-access__dot" />
            {project.isPublic ? texts.public : texts.private}
        </span>
    );

    const rowTags = (project: ProjectShort) =>
        project.tags?.length ? (
            <div className="projects-row-tags">
                {project.tags.map((tag) => (
                    <TagChip
                        key={tagKey(tag.name)}
                        tag={tag}
                        small
                        active={filter.tag === tagKey(tag.name)}
                        onClick={() => toggleTag(tag.name)}
                    />
                ))}
            </div>
        ) : null;

    const sortHeader = (field: SortField, label: string) => {
        const active = sort.field === field;
        return (
            <button
                type="button"
                className={classNames('projects-sort-button', {
                    'is-active': active,
                })}
                onClick={(e) => {
                    e.stopPropagation();
                    onSortColumn(field);
                }}
            >
                {label}
                <span className="sort-arrow" aria-hidden>
                    {active ? (sort.direction === 'asc' ? '▲' : '▼') : '▲▼'}
                </span>
            </button>
        );
    };
    const ariaSort = (field: SortField) =>
        sort.field === field
            ? sort.direction === 'asc'
                ? 'ascending'
                : 'descending'
            : undefined;

    const sortOptions = useMemo(
        () => [
            { value: 'modified-desc', label: `${texts.last_modified} ↓` },
            { value: 'modified-asc', label: `${texts.last_modified} ↑` },
            { value: 'created-desc', label: `${texts.created} ↓` },
            { value: 'created-asc', label: `${texts.created} ↑` },
            { value: 'title-asc', label: `${texts.title} A-Z` },
            { value: 'title-desc', label: `${texts.title} Z-A` },
        ],
        [texts.last_modified, texts.created, texts.title]
    );

    const renderState = (): ReactNode => {
        if (projects.length) {
            return null;
        }
        if (getProjectsRequestState === 'loading') {
            return (
                <div className="projects-loading-wrapper" aria-hidden>
                    <span className="projects-loading-spinner" />
                </div>
            );
        }
        if (
            getProjectsRequestState !== 'ok' &&
            getProjectsRequestState !== 'unknown'
        ) {
            return (
                <div className="projects-loading-wrapper" aria-hidden>
                    <div className="projects-loading-icon-with-text">
                        <span className="projects-loading-warning" />
                        <div className="projects-loading-caption">
                            {getProjectsRequestState === 'unauth'
                                ? (texts.errors.sessionExpiredReload ??
                                  dictionary.filemanager.errors.sessionExpired)
                                : dictionary.filemanager.errors.internalError}
                        </div>
                    </div>
                </div>
            );
        }
        return (
            <div className="projects-empty">
                <div className="projects-empty__title">{texts.empty_title}</div>
                <div className="projects-empty__text">{texts.empty_text}</div>
                <Button
                    classname="add-project-button"
                    rounded
                    color="blue"
                    title={texts.add}
                    minimize={false}
                    titleIcon={() => <PlusIcon />}
                    onPress={onAddProjectClick}
                />
            </div>
        );
    };

    const toolbar = (
        <div className="projects-toolbar">
            <label className="projects-search">
                <SearchIcon />
                <input
                    ref={searchRef}
                    type="search"
                    value={filter.search}
                    placeholder={texts.search_placeholder}
                    aria-label={texts.search_placeholder}
                    onChange={(e) =>
                        setFilter((current) => ({
                            ...current,
                            search: e.target.value,
                        }))
                    }
                    onKeyDown={(e) => {
                        if (e.key === 'Escape' && filter.search) {
                            e.stopPropagation();
                            setFilter((current) => ({
                                ...current,
                                search: '',
                            }));
                        }
                    }}
                />
                {!filter.search && !isMobile ? (
                    <kbd className="projects-search__hint">/</kbd>
                ) : null}
            </label>
            {showTypeFilter ? (
                <SegmentedControl<TypeFilter>
                    ariaLabel={texts.type}
                    value={filter.type}
                    options={[
                        { value: 'all', label: texts.all },
                        { value: 'latex', label: TYPE_LABELS.latex },
                        { value: 'markdown', label: TYPE_LABELS.markdown },
                    ]}
                    onChange={(type) => {
                        setFilter((current) => ({ ...current, type }));
                        trackFilter('type', type);
                    }}
                />
            ) : null}
            {showAccessFilter ? (
                <SegmentedControl<AccessFilter>
                    ariaLabel={texts.access}
                    value={filter.access}
                    options={[
                        { value: 'all', label: texts.all },
                        { value: 'public', label: texts.public },
                        { value: 'private', label: texts.private },
                    ]}
                    onChange={selectAccess}
                />
            ) : null}
            {isMobile ? (
                <div className="projects-mobile-sort">
                    <Select
                        options={sortOptions}
                        value={`${sort.field}-${sort.direction}`}
                        onChange={(value: unknown) => {
                            const [field, direction] = String(value).split(
                                '-'
                            ) as [SortField, ProjectsSort['direction']];
                            updateSort({ field, direction });
                        }}
                    />
                </div>
            ) : null}
        </div>
    );

    // на телефоне боковой панели нет, метки идут лентой над списком
    const tagFilter =
        isMobile && knownTags.length ? (
            <div className="projects-tags-filter" aria-label={texts.tags}>
                {knownTags.map((tag) => (
                    <TagChip
                        key={tagKey(tag.name)}
                        tag={tag}
                        small
                        count={tag.count}
                        active={filter.tag === tagKey(tag.name)}
                        onClick={() => toggleTag(tag.name)}
                    />
                ))}
            </div>
        ) : null;

    const summary =
        filterActive && visibleProjects.length ? (
            <div className="projects-summary">
                <span>
                    {texts.shown
                        .replace('${shown}', `${visibleProjects.length}`)
                        .replace('${total}', `${projects.length}`)}
                </span>
                <button
                    type="button"
                    className="projects-link-button"
                    onClick={resetFilters}
                >
                    {texts.reset_filters}
                </button>
            </div>
        ) : null;

    const noMatches = (
        <div className="projects-no-matches">
            <span>{texts.no_matches}</span>
            <button
                type="button"
                className="projects-link-button"
                onClick={resetFilters}
            >
                {texts.reset_filters}
            </button>
        </div>
    );

    const titleFor = (project: ProjectShort, tooltipId?: string) => (
        <ProjectTitle
            href={projectHref(project.projectId)}
            project={project}
            tooltipId={tooltipId}
            editing={renamingId === project.projectId}
            onEditingChange={(editing) => {
                if (editing) {
                    setRenamingId(project.projectId);
                } else if (renamingId === project.projectId) {
                    setRenamingId(null);
                }
            }}
        />
    );

    const cards = (
        <div className="projects-card-list">
            {visibleProjects.map((p) => (
                <div
                    key={p.projectId}
                    className="projects-card"
                    onClick={(e) => onProjectClick(e, p.projectId)}
                    onAuxClick={(e) => onProjectClick(e, p.projectId)}
                >
                    <div className="projects-card__main">
                        {titleFor(p)}
                        <div className="projects-card__meta">
                            {typeBadge(p)}
                            {accessBadge(p)}
                            <span title={fullTime(p.lastModified)}>
                                {relativeTime(p.lastModified)}
                            </span>
                        </div>
                        {rowTags(p)}
                    </div>
                    <ProjectActions
                        label={texts.actions.menu}
                        actions={actionsFor(p)}
                    />
                </div>
            ))}
        </div>
    );

    const table = (
        <>
            <table className="projects-table">
                <thead>
                    <tr>
                        <th aria-sort={ariaSort('title')}>
                            {sortHeader('title', texts.title)}
                        </th>
                        <th className="projects-col-type">{texts.type}</th>
                        <th className="projects-col-access">{texts.access}</th>
                        <th
                            className="projects-col-date"
                            aria-sort={ariaSort('modified')}
                        >
                            {sortHeader('modified', texts.last_modified)}
                        </th>
                        <th
                            className="projects-col-date projects-col-created"
                            aria-sort={ariaSort('created')}
                        >
                            {sortHeader('created', texts.created)}
                        </th>
                        <th className="projects-col-actions" />
                    </tr>
                </thead>
                <tbody>
                    {visibleProjects.map((p) => (
                        <tr
                            key={p.projectId}
                            className={classNames({
                                'is-renaming': renamingId === p.projectId,
                            })}
                            onClick={(e) => onProjectClick(e, p.projectId)}
                            onAuxClick={(e) => onProjectClick(e, p.projectId)}
                        >
                            <td className="projects-cell-title">
                                {titleFor(p, PROJECT_TITLE_TOOLTIP_ID)}
                                {rowTags(p)}
                            </td>
                            <td className="projects-col-type">
                                {typeBadge(p)}
                            </td>
                            <td className="projects-col-access">
                                {accessBadge(p)}
                            </td>
                            <td className="projects-col-date">
                                <a
                                    className="projects-row-link"
                                    href={projectHref(p.projectId)}
                                    title={fullTime(p.lastModified)}
                                    // та же ссылка, что у названия: Tab по ней второй раз не ходит
                                    tabIndex={-1}
                                >
                                    {relativeTime(p.lastModified)}
                                </a>
                            </td>
                            <td
                                className="projects-col-date projects-col-created"
                                title={fullTime(p.creationTime)}
                            >
                                {relativeTime(p.creationTime)}
                            </td>
                            <td className="projects-col-actions">
                                <ProjectActions
                                    label={texts.actions.menu}
                                    actions={actionsFor(p)}
                                />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <TruncatedTextTooltip
                id={PROJECT_TITLE_TOOLTIP_ID}
                isMobile={false}
            />
        </>
    );

    return (
        <>
            <div className="projects-container">
                {!isMobile && projects.length ? (
                    <ProjectsSidebar
                        projects={projects}
                        knownTags={knownTags}
                        access={filter.access}
                        tag={filter.tag}
                        untagged={filter.untagged}
                        onAdd={onAddProjectClick}
                        onSelectAccess={selectAccess}
                        onSelectTag={selectTag}
                        onSelectUntagged={selectUntagged}
                        onNewTag={() => setTagEdit({})}
                        onEditTag={(tag) => setTagEdit({ tag })}
                        onDeleteTag={setTagToDelete}
                    />
                ) : null}
                <div className="project-content-container">
                    <div className="projects-header">
                        <Typography
                            type="h1"
                            text={texts.label}
                            color={colors.black}
                        />
                        {projects.length ? (
                            <span className="projects-header__count">
                                {projects.length}
                            </span>
                        ) : null}
                        {/* на компьютере кнопка в боковой панели */}
                        {isMobile && projects.length ? (
                            <Button
                                classname="projects-header__add"
                                rounded
                                color="blue"
                                title={texts.add}
                                minimize={false}
                                titleIcon={() => <PlusIcon />}
                                onPress={onAddProjectClick}
                            />
                        ) : null}
                    </div>
                    {renderState() ?? (
                        <>
                            {toolbar}
                            {tagFilter}
                            {summary}
                            <div
                                className="projects-list-wrapper"
                                onPointerDownCapture={() => {
                                    pressedWhileRenaming.current =
                                        renamingId !== null;
                                }}
                            >
                                {!visibleProjects.length
                                    ? noMatches
                                    : isMobile
                                      ? cards
                                      : table}
                            </div>
                        </>
                    )}
                </div>
            </div>
            <Modal
                onClose={() => setDeleteTarget(null)}
                showModal={!!deleteTarget}
            >
                {deleteTarget ? (
                    <DeleteProjectModal
                        onClose={() => setDeleteTarget(null)}
                        projectId={deleteTarget.projectId}
                        projectName={deleteTarget.title}
                    />
                ) : null}
            </Modal>
            <Modal onClose={() => setTagEdit(null)} showModal={!!tagEdit}>
                {tagEdit ? (
                    <TagEditModal
                        tag={tagEdit.tag}
                        projects={sortProjects(
                            projects,
                            { field: 'title', direction: 'asc' },
                            collator
                        )}
                        knownTags={knownTags}
                        onClose={() => setTagEdit(null)}
                    />
                ) : null}
            </Modal>
            <Modal
                onClose={() => setTagToDelete(null)}
                showModal={!!tagToDelete}
            >
                {tagToDelete ? (
                    <div className="delete-project-modal">
                        <Typography
                            text={texts.sidebar.delete_tag_confirm.replace(
                                '${name}',
                                () => tagToDelete.name
                            )}
                            type="h2"
                            color={colors.gray10}
                        />
                        <div style={{ height: 17 }} />
                        <Button
                            classname="delete-project-modal-button"
                            onPress={() => {
                                dispatch(
                                    controller.onTagDeleteRequest({
                                        name: tagToDelete.name,
                                    })
                                );
                                setTagToDelete(null);
                            }}
                            title={dictionary.yes}
                            color="blue"
                            rounded
                            minimize={false}
                        />
                        <Button
                            classname="delete-project-modal-button"
                            onPress={() => setTagToDelete(null)}
                            title={dictionary.no}
                            color="gray"
                            rounded
                            minimize={false}
                        />
                    </div>
                ) : null}
            </Modal>
            <Modal
                onClose={() => setTagsTargetId(null)}
                showModal={!!tagsTarget}
            >
                {tagsTarget ? (
                    <TagsModal
                        project={tagsTarget}
                        knownTags={knownTags}
                        onClose={() => setTagsTargetId(null)}
                    />
                ) : null}
            </Modal>
        </>
    );
};
