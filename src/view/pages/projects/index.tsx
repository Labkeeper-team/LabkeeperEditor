import { useSelector } from 'react-redux';
import React, { useCallback, useState, useRef } from 'react';

import './style.scss';
import { Typography } from '../../components/typography';
import { Button } from '../../components/button';
import { PlusIcon } from '../../icons';
import { Modal } from '../../components/modal';
import { AddProjectModal } from './addProjectModal';
import { DeleteProjectModal } from './deleteProjectModal';
import { ProjectShort } from '../../../model/domain';
import { ProjectRow } from './projectRow';
import { ProjectTagsFilterModal } from './projectTagsFilterModal';
import { SortableHeaderCell } from './sortableHeaderCell';
import { TagChip } from './tagChip';
import { DEFAULT_TAG_COLOR } from './tagColorUtils';
import {
    SortDirection,
    SortMode,
    usePruneSelectedFilterTags,
    useSortedFilteredProjects,
} from './useSortedFilteredProjects';
import {
    useProjectTagKeysByProject,
    useSelectedFilterTagKeys,
    useTagMap,
} from '../../store/selectors/projectTags';
import { useProjects } from '../../store/selectors/program';
import { colors } from '../../styles/colors';
import { useDictionary } from '../../store/selectors/translations';
import { StorageState } from '../../store';
import useClickOutside from '../../hooks/useClickOutside';

const NO_IGNORE_SELECTORS: string[] = [];

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
    const projectsScrollContainerRef = useRef<HTMLDivElement | null>(null);

    const dictionary = useSelector(useDictionary);
    const projects = useSelector(useProjects);
    const selectedFilterTagKeys = useSelector(useSelectedFilterTagKeys);
    const tagMap = useSelector(useTagMap);
    const projectTagKeysByProject = useSelector(useProjectTagKeysByProject);
    const getProjectsRequestState = useSelector(
        (state: StorageState) => state.ide.getProjectsRequestState
    );

    usePruneSelectedFilterTags();

    const closeTagsFilterModal = useCallback(() => {
        setShowTagsFilterModal(false);
    }, []);

    const tagsFilterAnchorRef = useClickOutside(
        closeTagsFilterModal,
        NO_IGNORE_SELECTORS,
        showTagsFilterModal
    );

    const closeTagsUi = useCallback(() => {
        setShowTagsFilterModal(false);
        setOpenedTagPickerProjectId(null);
    }, []);

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

    const onTagsFilterButtonClick = useCallback(() => {
        if (showTagsFilterModal) {
            setShowTagsFilterModal(false);
            return;
        }
        setOpenedTagPickerProjectId(null);
        setShowTagsFilterModal(true);
    }, [showTagsFilterModal]);

    const onTagPickerButtonClick = useCallback(
        (e: React.MouseEvent<HTMLElement, unknown>, projectId: string) => {
            e.stopPropagation();
            if (openedTagPickerProjectId === projectId) {
                setOpenedTagPickerProjectId(null);
                return;
            }
            setShowTagsFilterModal(false);
            setOpenedTagPickerProjectId(projectId);
        },
        [openedTagPickerProjectId]
    );

    const filteredProjects = useSortedFilteredProjects({
        projects,
        sortMode,
        sortDirection,
        selectedFilterTagKeys,
        projectTagKeysByProject,
    });

    const onSortChange = useCallback(
        (mode: SortMode, direction: SortDirection) => {
            setSortMode(mode);
            setSortDirection(direction);
        },
        []
    );

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
                                    <TagChip
                                        key={`selected-filter-tag-${tagKey}`}
                                        label={tagMap[tagKey]?.label ?? tagKey}
                                        color={
                                            tagMap[tagKey]?.color ??
                                            DEFAULT_TAG_COLOR
                                        }
                                    />
                                ))}
                            </div>
                            <div
                                className="projects-filter-anchor"
                                ref={tagsFilterAnchorRef}
                            >
                                <button
                                    className="projects-filter-button"
                                    type="button"
                                    onClick={onTagsFilterButtonClick}
                                >
                                    {dictionary.projects.tags.filter_open}
                                    {selectedFilterTagKeys.length
                                        ? ` (${selectedFilterTagKeys.length})`
                                        : ''}
                                </button>
                                {showTagsFilterModal ? (
                                    <ProjectTagsFilterModal
                                        onClose={() =>
                                            setShowTagsFilterModal(false)
                                        }
                                    />
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
                        <div className="projects-empty-state">
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
                            className="projects-list-scroll"
                        >
                            <div className="projects-list">
                                <table>
                                    <tr>
                                        <th>
                                            <SortableHeaderCell
                                                label={
                                                    dictionary.projects.title
                                                }
                                                mode="title"
                                                sortMode={sortMode}
                                                sortDirection={sortDirection}
                                                onSortChange={onSortChange}
                                            />
                                        </th>
                                        <th>
                                            <SortableHeaderCell
                                                label={
                                                    dictionary.projects
                                                        .last_modified
                                                }
                                                mode="time"
                                                sortMode={sortMode}
                                                sortDirection={sortDirection}
                                                onSortChange={onSortChange}
                                            />
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
                                        <ProjectRow
                                            key={`${p.projectId}-${p.title}`}
                                            project={p}
                                            isTagPickerOpen={
                                                openedTagPickerProjectId ===
                                                p.projectId
                                            }
                                            tagsListBoundaryRef={
                                                projectsScrollContainerRef
                                            }
                                            onTagPickerButtonClick={(e) =>
                                                onTagPickerButtonClick(
                                                    e,
                                                    p.projectId
                                                )
                                            }
                                            onCloseTagsUi={closeTagsUi}
                                            onDeleteClick={onClickDeleteProject}
                                        />
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
