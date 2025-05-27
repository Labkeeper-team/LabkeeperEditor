import { useCallback, useState } from 'react';
import { Input } from '../../../components/input';
import { Typography } from '../../../components/typography';
import './style.scss';
import { Button } from '../../../components/button';
import { RightArrowIcon } from '../../../icons';
import { colors } from '../../../styles/colors';
import { useDispatch, useSelector } from 'react-redux';
import { useDictionary } from '../../../../viewModel/store/selectors/translations';
import { AppDispatch } from '../../../../viewModel/store';
import { onProjectCreateRequest } from '../../../../controller';

export const AddProjectModal = (props: { onClose: () => unknown }) => {
    const dispatch = useDispatch<AppDispatch>();
    const [projectName, setProjectName] = useState('');
    const [projectNameError, setProjectNameError] = useState<
        string | undefined
    >(undefined);
    const dictionary = useSelector(useDictionary);

    const onSubmit = useCallback(
        async (e) => {
            e?.preventDefault?.();

            dispatch(
                onProjectCreateRequest({
                    projectName: projectName,
                    errorCallback: (message) => {
                        setProjectNameError(message);
                    },
                    okCallback: () => {
                        props.onClose();
                    },
                })
            );
        },
        [dispatch, projectName, props]
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
