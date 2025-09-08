import { Typography } from '../../../components/typography';
import { Button } from '../../../components/button';

import './style.scss';
import { useDispatch, useSelector } from 'react-redux';
import { colors } from '../../../styles/colors';
import { useDictionary } from '../../../store/selectors/translations';
import { AppDispatch } from '../../../store';
import { controller } from '../../../../main.tsx';

export const DeleteProjectModal = (props: {
    onClose: () => void;
    projectId: string;
    projectName: string;
}) => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);

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
                onPress={() =>
                    dispatch(
                        controller.onDeleteProjectRequest({
                            projectId: props.projectId,
                            okCallback: props.onClose,
                        })
                    )
                }
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
