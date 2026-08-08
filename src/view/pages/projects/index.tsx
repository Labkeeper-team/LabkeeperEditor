import { useDispatch, useSelector } from 'react-redux';
import { formatDistance } from 'date-fns';
import { enGB, ru } from 'date-fns/locale';
import React, { useCallback, useMemo, useState } from 'react';

import './style.scss';
import { Typography } from '../../components/typography';
import { Button } from '../../components/button';
import { PlusIcon } from '../../icons';
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
import { useIsMobile } from '../../hooks/useMobile';
import { Select } from '../../components/select';

type SortMode = 'time' | 'title';
type SortDirection = 'asc' | 'desc';
type SortOption = `${SortMode}-${SortDirection}`;

export const ProjectsPage = () => {
    const [showAddModal, setShowAddModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState<
        false | ProjectShort
    >(false);
    const [sortMode, setSortMode] = useState<SortMode>('time');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    const dictionary = useSelector(useDictionary);
    const lang = useSelector(useCurrentLanguage);
    const projects = useSelector(useProjects);
    const getProjectsRequestState = useSelector(
        (state: StorageState) => state.ide.getProjectsRequestState
    );
    const dispatch = useDispatch<AppDispatch>();
    const isMobile = useIsMobile();

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

    const sortOptions = useMemo(
        () => [
            {
                value: 'time-desc',
                label: `${dictionary.projects.last_modified} ↓`,
            },
            {
                value: 'time-asc',
                label: `${dictionary.projects.last_modified} ↑`,
            },
            {
                value: 'title-asc',
                label: `${dictionary.projects.title} A-Z`,
            },
            {
                value: 'title-desc',
                label: `${dictionary.projects.title} Z-A`,
            },
        ],
        [dictionary.projects.last_modified, dictionary.projects.title]
    );

    const currentSortValue: SortOption = `${sortMode}-${sortDirection}`;

    const onSortOptionChange = useCallback((value: unknown) => {
        const [mode, direction] = String(value).split('-') as [
            SortMode,
            SortDirection,
        ];
        setSortMode(mode);
        setSortDirection(direction);
    }, []);

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

    return (
        <>
            <div className="projects-container">
                <div className="project-content-container">
                    <Typography
                        type="h1"
                        text={dictionary.projects.label}
                        color={colors.black}
                    />
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
                        <div className="projects-list-wrapper">
                            {isMobile ? (
                                <>
                                    <div className="projects-mobile-sort">
                                        <Select
                                            options={sortOptions}
                                            value={currentSortValue}
                                            onChange={onSortOptionChange}
                                        />
                                    </div>
                                    <div className="projects-card-list">
                                        {sortedProjects.map((p) => (
                                            <div
                                                key={`${p.projectId}-${p.title}`}
                                                className="projects-card"
                                                onClick={() =>
                                                    openProject(p.projectId)
                                                }
                                            >
                                                <div className="projects-card__main">
                                                    <ProjectTitle project={p} />
                                                    <Typography
                                                        color={colors.gray30}
                                                        text={formatDistance(
                                                            new Date(),
                                                            new Date(
                                                                p.lastModified!
                                                            ),
                                                            { locale: localize }
                                                        )}
                                                        type="body-large"
                                                    />
                                                </div>
                                                <div
                                                    onClick={(e) =>
                                                        onClickDeleteProject(
                                                            e,
                                                            p
                                                        )
                                                    }
                                                    className="delete-project-container projects-card__delete"
                                                >
                                                    <div className="delete-icon">
                                                        <PlusIcon />
                                                    </div>
                                                    <Typography
                                                        color={colors.black}
                                                        text={dictionary.delete}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
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
                                                            setSortMode(
                                                                'title'
                                                            );
                                                            setSortDirection(
                                                                'asc'
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
                                                            setSortMode(
                                                                'title'
                                                            );
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
                                                            setSortDirection(
                                                                'asc'
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
                                            <th></th>
                                        </tr>
                                        {sortedProjects.map((p) => (
                                            <tr
                                                onClick={() =>
                                                    openProject(p.projectId)
                                                }
                                                key={`${p.projectId}-${p.title}`}
                                            >
                                                <td
                                                    style={{
                                                        height: 63,
                                                        width: '33%',
                                                        minWidth: '40ch',
                                                    }}
                                                >
                                                    <ProjectTitle project={p} />
                                                </td>
                                                <td>
                                                    <Typography
                                                        color={colors.gray30}
                                                        text={formatDistance(
                                                            new Date(),
                                                            new Date(
                                                                p.lastModified!
                                                            ),
                                                            { locale: localize }
                                                        )}
                                                        type="body-large"
                                                    />
                                                </td>
                                                <td>
                                                    <div
                                                        onClick={(e) =>
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
                                                            color={colors.black}
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
                                                </td>
                                            </tr>
                                        ))}
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                    {projects.length ? (
                        <div className="add-project-button-footer">
                            <Button
                                rounded
                                color="gray"
                                title={dictionary.projects.add}
                                minimize={false}
                                titleIcon={() => <PlusIcon />}
                                onPress={onAddProjectClick}
                            />
                        </div>
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
