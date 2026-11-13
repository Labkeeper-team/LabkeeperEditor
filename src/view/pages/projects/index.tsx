import { useDispatch, useSelector } from 'react-redux';
import React, {
    ReactNode,
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import { useNavigate } from 'react-router-dom';

import { toast } from 'react-toastify';
import classNames from 'classnames';

import './style.scss';
import { Typography } from '../../components/typography';
import { Button } from '../../components/button';
import { PlusIcon } from '../../icons';
import { Modal } from '../../components/modal';
import { DeleteProjectModal } from './deleteProjectModal';
import { ProjectShort, ProjectTag } from '../../../model/domain';
import { useProjects } from '../../store/selectors/program';
import { colors } from '../../styles/colors';
import { useDictionary } from '../../store/selectors/translations';
import { AppDispatch, StorageState } from '../../store';
import { controller } from '../../../main.tsx';
import { Events } from '../../../model/service/ObserverService.ts';
import { useIsMobile } from '../../hooks/useMobile';
import { Routes } from '../../../viewModel/routes.ts';
import { TagChip } from './tagChip';
import { TagsModal } from './tagsModal';
import { MenuAction } from '../../components/actionMenu';
import { ProjectsSidebar } from './projectsSidebar';
import { TagEditModal } from './tagEditModal';
import { DeleteTagModal } from './deleteTagModal';
import {
    sortProjects,
    tagKey,
} from '../../../viewModel/domain/projectsFilter.ts';
import { copyText } from '../../utils/copyText.ts';
import { shownText, useProjectsFilter } from './useProjectsFilter.ts';
import { ProjectsToolbar } from './ProjectsToolbar.tsx';
import { ProjectsTable } from './ProjectsTable.tsx';
import { ProjectsCards } from './ProjectsCards.tsx';
import { projectHref } from './projectLinks.ts';

/**
 * Страница «Проекты»: боковая панель с доступом и метками, поиск и фильтры,
 * таблица на компьютере и карточки на телефоне. Фильтр и сортировка живут
 * в useProjectsFilter, а здесь то, что связывает части: переименование на
 * месте, меню проекта и окна
 */
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
    const searchRef = useRef<HTMLInputElement>(null);

    const dictionary = useSelector(useDictionary);
    const texts = dictionary.projects;
    const projects = useSelector(useProjects);
    const getProjectsRequestState = useSelector(
        (state: StorageState) => state.ide.getProjectsRequestState
    );
    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();
    const isMobile = useIsMobile();

    const filterState = useProjectsFilter(projects);
    const { filter, filterActive, visibleProjects, knownTags } = filterState;

    const tagsTarget = tagsTargetId
        ? projects.find((project) => project.projectId === tagsTargetId)
        : undefined;

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

    /** Удалённая метка перестаёт быть выбранной, даже если появится снова */
    const deleteTag = useCallback(
        (name: string) => {
            filterState.onTagDeleted(name);
            dispatch(controller.onTagDeleteRequest({ name }));
        },
        [dispatch, filterState]
    );

    const actionsFor = useCallback(
        (project: ProjectShort): MenuAction[] => {
            const id = project.projectId;
            const actions: MenuAction[] = [
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

    const listProps = {
        projects: visibleProjects,
        activeTag: filter.tag,
        onToggleTag: filterState.toggleTag,
        renamingId,
        onRenamingChange: (projectId: string, editing: boolean) => {
            if (editing) {
                setRenamingId(projectId);
            } else if (renamingId === projectId) {
                setRenamingId(null);
            }
        },
        onProjectClick,
        actionsFor,
    };

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
                        onClick={() => filterState.toggleTag(tag.name)}
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
                onClick={() => filterState.resetFilters('no_matches')}
            >
                {texts.reset_filters}
            </button>
        </div>
    );

    const shown = shownText(texts.shown, filterState, projects.length);

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
                        onSelectAll={filterState.selectAll}
                        onSelectAccess={filterState.selectAccess}
                        onSelectTag={filterState.selectTag}
                        onSelectUntagged={filterState.selectUntagged}
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
                        {isMobile && filterActive && projects.length ? (
                            // на телефоне инструменты идут столбиком, и сводке место
                            // только в шапке: «N из M ×», от фильтра она не растёт
                            <button
                                type="button"
                                className="projects-header__count projects-header__count--filtered"
                                title={texts.reset_filters}
                                aria-label={`${shown}. ${texts.reset_filters}`}
                                onClick={() =>
                                    filterState.resetFilters('header')
                                }
                            >
                                {shown}
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
                            <ProjectsToolbar
                                state={filterState}
                                total={projects.length}
                                isMobile={isMobile}
                                searchRef={searchRef}
                            />
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
                                {!visibleProjects.length ? (
                                    noMatches
                                ) : isMobile ? (
                                    <ProjectsCards {...listProps} />
                                ) : (
                                    <ProjectsTable
                                        {...listProps}
                                        sort={filterState.sort}
                                        onSortColumn={filterState.onSortColumn}
                                    />
                                )}
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
                            filterState.collator
                        )}
                        knownTags={knownTags}
                        onSaved={filterState.onTagSaved}
                        onClose={() => setTagEdit(null)}
                    />
                ) : null}
            </Modal>
            <Modal
                onClose={() => setTagToDelete(null)}
                showModal={!!tagToDelete}
            >
                {tagToDelete ? (
                    <DeleteTagModal
                        name={tagToDelete.name}
                        onConfirm={() => {
                            deleteTag(tagToDelete.name);
                            setTagToDelete(null);
                        }}
                        onClose={() => setTagToDelete(null)}
                    />
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
