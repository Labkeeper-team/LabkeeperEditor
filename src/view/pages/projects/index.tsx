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
    DEFAULT_SORT,
    isSort,
    matchesFilter,
    sortProjects,
    tagKey,
    uniqueTags,
} from '../../../viewModel/domain/projectsFilter.ts';
import { setProjectsSort } from '../../store/slices/persistence';

const PROJECT_TITLE_TOOLTIP_ID = 'projects-title-tooltip';

const TYPE_LABELS: Record<string, string> = {
    latex: 'LaTeX',
    markdown: 'Markdown',
};

const projectHref = (projectId?: string) =>
    Routes.Project.replace(':id', projectId ?? '');

/**
 * Текст в буфер обмена. navigator.clipboard есть только на HTTPS и
 * localhost, поэтому без него копируем через выделенное поле
 */
const copyText = async (text: string) => {
    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return;
        } catch {
            // браузер не дал доступа к буферу: пробуем по-старому
        }
    }
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    // iOS Safari выделяет поле только так
    field.setSelectionRange(0, text.length);
    try {
        if (!document.execCommand('copy')) {
            throw new Error('copy rejected');
        }
    } finally {
        field.remove();
    }
};

/** Что известно о выбранной метке, см. ProjectsPage */
interface TagMemory {
    tag: string | null;
    /** Прежнее имя переименованной метки, пока сервер не ответил */
    fallback: string | null;
    /** Метку уже видели в списке */
    seen: boolean;
}

const NO_TAG_MEMORY: TagMemory = { tag: null, fallback: null, seen: false };

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
     * пуст; без этой отметки тот же щелчок открыл бы проект. Отметка живёт
     * до ближайшего щелчка, а щелчок с клавиатуры (detail 0) её не смотрит
     */
    const pressedWhileRenaming = useRef(false);
    const clickEndsRename = useRef(false);
    const takePress = (e: React.MouseEvent) => {
        clickEndsRename.current = e.detail > 0 && pressedWhileRenaming.current;
        pressedWhileRenaming.current = false;
    };
    // окно метки из боковой панели: {} создаёт новую, { tag } правит её
    const [tagEdit, setTagEdit] = useState<{ tag?: ProjectTag } | null>(null);
    const [tagToDelete, setTagToDelete] = useState<ProjectTag | null>(null);
    // сортировка лежит в общем хранилище и переживает перезагрузку
    const savedSort = useSelector(
        (state: StorageState) => state.persistence.projectsSort
    );
    const sort = isSort(savedSort) ? savedSort : DEFAULT_SORT;
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
    const knownKeys = useMemo(
        () => new Set(knownTags.map((tag) => tagKey(tag.name))),
        [knownTags]
    );

    /*
     * Выбранная метка может пропасть: её сняли со всех проектов или её
     * переименование не удалось. Метку, которую уже видели в списке, тогда
     * снимаем совсем, а не прячем: иначе выбор сам включился бы, когда метка
     * с тем же именем появится снова. После неудачного переименования выбор
     * возвращается к прежнему имени
     */
    const [tagMemory, setTagMemory] = useState<TagMemory>(NO_TAG_MEMORY);
    const memory =
        tagMemory.tag === rawFilter.tag
            ? tagMemory
            : { tag: rawFilter.tag, fallback: null, seen: false };
    const tagKnown = rawFilter.tag !== null && knownKeys.has(rawFilter.tag);
    const fallbackKnown =
        memory.fallback !== null && knownKeys.has(memory.fallback);
    if (tagKnown && (!memory.seen || memory !== tagMemory)) {
        setTagMemory({ ...memory, seen: true });
    } else if (rawFilter.tag !== null && !tagKnown && memory.seen) {
        const next = fallbackKnown ? memory.fallback : null;
        setFilter((current) => ({ ...current, tag: next }));
        setTagMemory({ tag: next, fallback: null, seen: next !== null });
    }
    const selectedTag = tagKnown
        ? rawFilter.tag
        : fallbackKnown
          ? memory.fallback
          : null;
    const filter = useMemo<ProjectsFilter>(
        () =>
            selectedTag === rawFilter.tag
                ? rawFilter
                : { ...rawFilter, tag: selectedTag },
        [rawFilter, selectedTag]
    );

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
    // на компьютере доступ выбирается в боковой панели, где разделы видны
    // всегда; на телефоне так же, по ТЗ, даже если публичных проектов нет
    const showAccessFilter = isMobile;
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
            dispatch(setProjectsSort(next));
            trackFilter('sort', `${next.field}-${next.direction}`);
        },
        [dispatch, trackFilter]
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
        trackFilter('tag', filter.untagged ? 'all' : 'untagged');
    }, [trackFilter, filter.untagged]);

    /** «Все проекты» в боковой панели: доступ и метка сразу, одним событием */
    const selectAll = useCallback(() => {
        setFilter((current) => ({
            ...current,
            access: 'all',
            tag: null,
            untagged: false,
        }));
        trackFilter('access', 'all');
    }, [trackFilter]);

    const selectAccess = useCallback(
        (access: AccessFilter) => {
            setFilter((current) => ({ ...current, access }));
            trackFilter('access', access);
        },
        [trackFilter]
    );

    /** place: какой кнопкой сбросили, счётчиком в шапке или под «ничего нет» */
    const resetFilters = useCallback(
        (place: 'header' | 'no_matches') => {
            setFilter(EMPTY_FILTER);
            trackFilter('reset', place);
        },
        [trackFilter]
    );

    // поиск считаем, когда человек перестал печатать, а не на каждую букву;
    // сам запрос не отправляем
    const searching = filter.search.trim() !== '';
    useEffect(() => {
        if (!searching) {
            return;
        }
        const timer = setTimeout(() => trackFilter('search', null), 1500);
        return () => clearTimeout(timer);
    }, [filter.search, searching, trackFilter]);

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
                target?.closest('input, textarea, select, [contenteditable]') ||
                // за открытым окном поиск не трогаем
                document.querySelector('.modal-container-overlay')
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
            if (clickEndsRename.current || renamingId === projectId) {
                clickEndsRename.current = false;
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
            copyText(url)
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
                    toast(texts.errors.copy_link_failed, { type: 'error' });
                });
        },
        [texts.link_copied, texts.errors.copy_link_failed]
    );

    /** Выбранная метка идёт за переименованием, а не сбрасывается */
    const onTagSaved = useCallback(
        (previousName: string | undefined, name: string) => {
            if (
                previousName === undefined ||
                rawFilter.tag !== tagKey(previousName)
            ) {
                return;
            }
            // прежнее имя запоминаем: если сервер откажет, выбор вернётся к нему
            setFilter((current) => ({ ...current, tag: tagKey(name) }));
            setTagMemory({
                tag: tagKey(name),
                fallback: tagKey(previousName),
                seen: false,
            });
        },
        [rawFilter.tag]
    );

    /** Удалённая метка перестаёт быть выбранной, даже если появится снова */
    const deleteTag = useCallback(
        (name: string) => {
            setFilter((current) =>
                current.tag === tagKey(name)
                    ? { ...current, tag: null }
                    : current
            );
            dispatch(controller.onTagDeleteRequest({ name }));
        },
        [dispatch]
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
                {uniqueTags(project.tags).map((tag) => (
                    <TagChip
                        // ключ по точному имени: «Физика» и «физика» две метки
                        key={tag.name}
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
            { value: 'title-asc', label: `${texts.title}, ${texts.sort_az}` },
            { value: 'title-desc', label: `${texts.title}, ${texts.sort_za}` },
        ],
        [
            texts.last_modified,
            texts.created,
            texts.title,
            texts.sort_az,
            texts.sort_za,
        ]
    );

    // на компьютере панель есть и пока список грузится: иначе с её
    // появлением вся страница съехала бы вправо
    const showSidebar =
        !isMobile &&
        (projects.length > 0 ||
            getProjectsRequestState === 'loading' ||
            getProjectsRequestState === 'unknown');

    const renderState = (): ReactNode => {
        if (projects.length) {
            return null;
        }
        // до первого ответа список ещё не известен: это загрузка, а не «проектов нет»
        if (
            getProjectsRequestState === 'loading' ||
            getProjectsRequestState === 'unknown'
        ) {
            return (
                <div className="projects-loading-wrapper" aria-hidden>
                    <span className="projects-loading-spinner" />
                </div>
            );
        }
        if (getProjectsRequestState !== 'ok') {
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

    const shownText = texts.shown
        .replace('${shown}', `${visibleProjects.length}`)
        .replace('${total}', `${projects.length}`);

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
            {/* на компьютере виден только без колонки «Создан», это решает CSS */}
            {projects.length ? (
                <div
                    className={classNames('projects-mobile-sort', {
                        'projects-mobile-sort--desktop': !isMobile,
                    })}
                >
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

    const noMatches = (
        <div className="projects-no-matches">
            <span>{texts.no_matches}</span>
            <button
                type="button"
                className="projects-link-button"
                onClick={() => resetFilters('no_matches')}
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
                {showSidebar ? (
                    <ProjectsSidebar
                        projects={projects}
                        knownTags={knownTags}
                        access={filter.access}
                        tag={filter.tag}
                        untagged={filter.untagged}
                        onAdd={onAddProjectClick}
                        showCounts={
                            projects.length > 0 ||
                            getProjectsRequestState === 'ok'
                        }
                        onSelectAll={selectAll}
                        onSelectAccess={selectAccess}
                        onSelectTag={selectTag}
                        onSelectUntagged={selectUntagged}
                        onNewTag={() => setTagEdit({})}
                        onEditTag={(tag) => setTagEdit({ tag })}
                        onDeleteTag={setTagToDelete}
                    />
                ) : null}
                <div className="project-content-container">
                    <div
                        className={classNames('projects-header', {
                            'projects-header--filtered': filterActive,
                        })}
                    >
                        <Typography
                            type="h1"
                            text={texts.label}
                            color={colors.black}
                        />
                        {filterActive && projects.length ? (
                            // «N из M» в счётчике: строка заголовка от фильтра не
                            // меняет высоту, и список под ним не сдвигается
                            <button
                                type="button"
                                className="projects-header__count projects-header__count--filtered"
                                title={texts.reset_filters}
                                aria-label={`${shownText}. ${texts.reset_filters}`}
                                onClick={() => resetFilters('header')}
                            >
                                {shownText}
                                <span aria-hidden>×</span>
                            </button>
                        ) : projects.length ? (
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
                            <div
                                className="projects-list-wrapper"
                                onPointerDownCapture={() => {
                                    pressedWhileRenaming.current =
                                        renamingId !== null;
                                }}
                                onClickCapture={takePress}
                                onAuxClickCapture={takePress}
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
                        onSaved={onTagSaved}
                        onClose={() => setTagEdit(null)}
                    />
                ) : null}
            </Modal>
            <Modal
                onClose={() => setTagToDelete(null)}
                showModal={!!tagToDelete}
            >
                {tagToDelete ? (
                    <div className="delete-project-modal delete-tag-modal">
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
                                deleteTag(tagToDelete.name);
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
