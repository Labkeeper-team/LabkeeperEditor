import { Typography } from '../../../componenets/typography';
import { Button } from '../../../componenets/button';

import './style.scss';
import { useDispatch, useSelector } from 'react-redux';
import { setProjects } from '../../../store/slices/projects';
import { colors } from '../../../shared/styles/colors';
import { useDictionary } from '../../../store/selectors/translations';
import {
    deleteProjectRequest,
    getAllProjectsRequest,
} from '../../../rpi/project.tsx';
import { toast } from 'react-toastify';
import { logoutAction } from '../../../store/actions';
import { Project } from '../../../shared/models/project.ts';

export const DeleteProjectModal = (props: {
    onClose: () => unknown;
    projectId: number;
    projectName: string;
}) => {
    const dispatch = useDispatch();
    const dictionary = useSelector(useDictionary);
    const onDelete = async () => {
        const result1 = await deleteProjectRequest(props.projectId.toString());
        if (result1.isOk) {
            props.onClose();
            const result2 = await getAllProjectsRequest();
            if (result2.isOk) {
                dispatch(
                    setProjects(
                        (result2.body as { projects: Array<Project> }).projects
                    )
                );
            }
            if (result2.isUnauth) {
                toast(dictionary.filemanager.errors.sessionExpired, {
                    type: 'error',
                });
                dispatch(logoutAction);
            }
        }
        if (result1.isUnauth) {
            toast(dictionary.filemanager.errors.sessionExpired, {
                type: 'error',
            });
            dispatch(logoutAction);
        }
    };
    return (
        <div className="delete-project-modal">
            <Typography
                text={`${dictionary.delete_modal} "${props.projectName}" ?`}
                type="h2"
                color={colors.gray10}
            />
            <div style={{ height: 17 }} />
            <Button
                classname="delete-project-modal-button"
                onPress={onDelete}
                title={dictionary.yes}
                color="blue"
                rounded
                minimize={false}
            />
            <Button
                classname="delete-project-modal-button"
                onPress={props.onClose}
                title={dictionary.no}
                color="gray"
                rounded
                minimize={false}
            />
        </div>
    );
};
