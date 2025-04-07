import { useDispatch, useSelector } from 'react-redux';
import { formatDistance } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { enGB, ru } from 'date-fns/locale';
import React, { useEffect, useMemo, useState } from 'react';
import { Routes } from '../../routing/routes';
import { setProjects } from '../../store/slices/projects';

import './style.scss';
import { Typography } from '../../componenets/typography';
import { Button } from '../../componenets/button';
import { PlusIcon } from '../../shared/icons';
import { Modal } from '../../shared/components/modal';
import { AddProjectModal } from './addProjectModal';
import { DeleteProjectModal } from './deleteProjectModal';
import { Project, ProjectShort } from '../../shared/models/project';
import { ProjectTitle } from './projectTitle';
import { useProjects, useUser } from '../../store/selectors/program';
import { colors } from '../../shared/styles/colors';
import {
    useCurrentLanguge,
    useDictionary,
} from '../../store/selectors/translations';
import { getAllProjectsRequest } from '../../rpi/project.tsx';
import { toast } from 'react-toastify';
import { logoutAction } from '../../store/actions';

export const ProjectsPage = () => {
    const [showAddModal, setShowAddModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState<
        false | ProjectShort
    >(false);

    const user = useSelector(useUser);
    const dictionary = useSelector(useDictionary);
    const lang = useSelector(useCurrentLanguge);
    const projects = useSelector(useProjects);
    const navigate = useNavigate();
    const dispatch = useDispatch();

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

    const onFetchData = async () => {
        const result = await getAllProjectsRequest();
        if (result.isOk) {
            dispatch(
                setProjects(
                    (
                        result.body as { projects: Array<Project> }
                    ).projects.reverse()
                )
            );
        }
        if (result.isUnauth) {
            toast(dictionary.filemanager.errors.sessionExpired, {
                type: 'error',
            });
            dispatch(logoutAction);
        }
    };
    useEffect(() => {
        if (!user.isAuthenticated) {
            navigate(Routes.ProjectDefault);
        }
    }, [user, navigate]);

    useEffect(() => {
        if (!user.isAuthenticated) {
            return;
        }

        onFetchData();
    }, [user.isAuthenticated, dispatch]);

    const onClick = () => {
        setShowAddModal(true);
    };
    const onClickDeleteProject = (
        e: React.MouseEvent<HTMLElement, unknown>,
        project: ProjectShort
    ) => {
        e.stopPropagation();
        setShowDeleteModal(project);
    };

    const onRowClick = (projectId: number) => {
        navigate(Routes.Project.replace(':id', projectId.toString()));
    };

    return (
        <>
            <div className="projects-container">
                <div className="project-content-container">
                    <Typography
                        type="h1"
                        text={dictionary.projects.label}
                        color={colors.black}
                    />
                    {!projects.length ? (
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
                                titleIcon={PlusIcon}
                                onPress={onClick}
                            />
                        </div>
                    ) : (
                        <div
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
                                            <Typography
                                                color={colors.gray30}
                                                text={dictionary.projects.title}
                                            />
                                        </th>
                                        <th>
                                            <Typography
                                                color={colors.gray30}
                                                text={
                                                    dictionary.projects
                                                        .last_modified
                                                }
                                            />
                                        </th>
                                        <th></th>
                                    </tr>
                                    {projects.map((p) => (
                                        <tr
                                            onClick={() =>
                                                onRowClick(p.projectId!)
                                            }
                                            key={`${p.projectId}-${p.title}`}
                                        >
                                            <td
                                                style={{
                                                    height: 63,
                                                    width: '33%',
                                                }}
                                            >
                                                <ProjectTitle
                                                    project={p}
                                                    onSuccessRename={
                                                        onFetchData
                                                    }
                                                />
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
                                                        text={dictionary.delete}
                                                    />
                                                    <div
                                                        style={{ width: 10 }}
                                                    />
                                                </div>
                                            </td>
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
                            titleIcon={PlusIcon}
                            onPress={onClick}
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
