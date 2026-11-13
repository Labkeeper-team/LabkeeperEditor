import { useSelector } from 'react-redux';

import { Button } from '../../../components/button';
import { Typography } from '../../../components/typography';
import { useDictionary } from '../../../store/selectors/translations';
import { colors } from '../../../styles/colors';

/**
 * «Снять тег «Физика» со всех проектов? Сами проекты останутся». Разметка
 * та же, что у подтверждения удаления проекта
 */
export const DeleteTagModal = ({
    name,
    onConfirm,
    onClose,
}: {
    name: string;
    onConfirm: () => void;
    onClose: () => void;
}) => {
    const dictionary = useSelector(useDictionary);
    return (
        <div className="delete-project-modal delete-tag-modal">
            <Typography
                text={dictionary.projects.sidebar.delete_tag_confirm.replace(
                    '${name}',
                    () => name
                )}
                type="h2"
                color={colors.gray10}
            />
            <div style={{ height: 17 }} />
            <Button
                classname="delete-project-modal-button"
                onPress={onConfirm}
                title={dictionary.yes}
                color="blue"
                rounded
                minimize={false}
            />
            <Button
                classname="delete-project-modal-button"
                onPress={onClose}
                title={dictionary.no}
                color="gray"
                rounded
                minimize={false}
            />
        </div>
    );
};
