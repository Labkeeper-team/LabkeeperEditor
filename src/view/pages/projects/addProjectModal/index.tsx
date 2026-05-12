import { useCallback, useState } from 'react';
import { Input } from '../../../components/input';
import { Typography } from '../../../components/typography';
import './style.scss';
import { Button } from '../../../components/button';
import { RightArrowIcon } from '../../../icons';
import { colors } from '../../../styles/colors';
import { useDispatch, useSelector } from 'react-redux';
import { useDictionary } from '../../../store/selectors/translations';
import { AppDispatch } from '../../../store';
import { controller } from '../../../../main.tsx';
import { ProjectType } from '../../../../model/domain.ts';
import { Radio } from '../../../components/radiobutton';

export const AddProjectModal = (props: { onClose: () => unknown }) => {
    const dispatch = useDispatch<AppDispatch>();
    const [projectName, setProjectName] = useState('');
    const [projectType, setProjectType] = useState<ProjectType>('markdown');
    const [projectNameError, setProjectNameError] = useState<
        string | undefined
    >(undefined);
    const dictionary = useSelector(useDictionary);

    const onSubmit = useCallback(
        async (e) => {
            e?.preventDefault?.();

            dispatch(
                controller.onProjectCreateRequest({
                    projectName: projectName,
                    projectType: projectType,
                    errorCallback: (message) => {
                        setProjectNameError(message);
                    },
                    okCallback: () => {
                        props.onClose();
                    },
                })
            );
        },
        [dispatch, projectName, projectType, props]
    );

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
                    onChange={(e) => setProjectName(e.target.value)}
                    title={dictionary.create_modal.name}
                    value={projectName}
                    error={projectNameError}
                />
                <div className="add-project-modal-type">
                    <Typography
                        text={dictionary.create_modal.project_type}
                        color={colors.gray20}
                    />
                    <div className="add-project-modal-type-options">
                        <Radio
                            id="create-project-type-markdown"
                            checked={projectType === 'markdown'}
                            onChange={() => setProjectType('markdown')}
                            title={dictionary.create_modal.type_markdown}
                        />
                        <Radio
                            id="create-project-type-latex"
                            checked={projectType === 'latex'}
                            onChange={() => setProjectType('latex')}
                            title={dictionary.create_modal.type_latex}
                        />
                    </div>
                </div>
            </form>
            <Button
                classname="add-project-modal-button"
                onPress={() => onSubmit(undefined)}
                disabled={!projectName.length}
                title={dictionary.create_modal.create}
                titleIcon={() => <RightArrowIcon />}
                color="green"
                rounded
                minimize={false}
            />
        </div>
    );
};
