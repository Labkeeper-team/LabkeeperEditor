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
import { useProjects } from '../../../viewModel/store/selectors/program';
import { colors } from '../../styles/colors';
import {
    useCurrentLanguage,
    useDictionary,
} from '../../../viewModel/store/selectors/translations';
import { onRowClickedInProjectsListRequest } from '../../../controller';
import { AppDispatch } from '../../../viewModel/store';

export const ProjectsPage = () => {
    const [showAddModal, setShowAddModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState<
        false | ProjectShort
    >(false);

    const dictionary = useSelector(useDictionary);
    const lang = useSelector(useCurrentLanguage);
    const projects = useSelector(useProjects);
    const dispatch = useDispatch<AppDispatch>();

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
                                titleIcon={() => <PlusIcon />}
                                onPress={onAddProjectClick}
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
                                            onClick={() => {
                                                if (p.projectId) {
                                                    dispatch(
                                                        onRowClickedInProjectsListRequest(
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
