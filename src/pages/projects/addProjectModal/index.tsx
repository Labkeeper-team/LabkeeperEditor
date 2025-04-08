import { useState } from 'react';
import { Input } from '../../../components/input';
import { Typography } from '../../../components/typography';
import './style.scss';
import { Button } from '../../../components/button';
import { RightArrowIcon } from '../../../shared/icons';
import { useNavigate } from 'react-router-dom';
import { Routes } from '../../../routing/routes';
import { colors } from '../../../shared/styles/colors';
import { useDispatch, useSelector } from 'react-redux';
import { useDictionary } from '../../../store/selectors/translations';
import { createProjectRequest } from '../../../rpi/project.tsx';
import { toast } from 'react-toastify';
import { logoutAction } from '../../../store/actions';
import { Project } from '../../../shared/models/project.ts';

const emptyProject = {
    segments: [],
    parameters: {
        roundStrategy: 'noRound',
    },
};

export const AddProjectModal = (props: { onClose: () => unknown }) => {
    // without form because only one field
    const [projectName, setProjectName] = useState('');
    const [projectNameError, setProjectNameError] = useState<
        string | undefined
    >(undefined);
    const dictionary = useSelector(useDictionary);
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setProjectName(e.target.value);
    };

    const onSubmit = async (e) => {
        e?.preventDefault?.();
        const projectNameToSend = projectName.trim();
        if (!projectNameToSend) {
            setProjectNameError(dictionary.create_modal.error.empty_name);
            return;
        }

        const result = await createProjectRequest(projectName, emptyProject);
        if (result.isUnauth) {
            toast(dictionary.filemanager.errors.sessionExpired, {
                type: 'error',
            });
            dispatch(logoutAction);
        }
        if (result.isOk) {
            navigate(
                Routes.Project.replace(
                    ':id',
                    (result.body as Project).projectId + ''
                )
            );
            props.onClose();
        } else {
            const message =
                result.code === 417
                    ? dictionary.create_modal.error.too_many_projects
                    : result.code.toString();
            setProjectNameError(message);
        }
    };
    return (
        <div className="add-project-modal">
            <Typography
                text={dictionary.create_modal.label}
                type="h2"
                color={colors.gray10}
            />
            <div style={{ height: 28 }} />
            <form onSubmit={onSubmit}>
                <Input
                    onChange={onChange}
                    title={dictionary.create_modal.name}
                    value={projectName}
                    error={projectNameError}
                />
            </form>
            <Button
                classname="add-project-modal-button"
                onPress={() => onSubmit(undefined)}
                disabled={!projectName.length}
                title={dictionary.create_modal.create}
                titleIcon={RightArrowIcon}
                color="green"
                rounded
                minimize={false}
            />
        </div>
    );
};
