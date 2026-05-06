import { useSelector } from 'react-redux';

import { Modal } from '../../modal';
import { Typography } from '../../typography';
import { Button } from '../../button';
import { colors } from '../../../styles/colors';
import { useDictionary } from '../../../store/selectors/translations';
import './style.scss';

export type LogoutConfirmModalProps = {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
};

export const LogoutConfirmModal = ({
    open,
    onClose,
    onConfirm,
}: LogoutConfirmModalProps) => {
    const dictionary = useSelector(useDictionary);

    return (
        <Modal showModal={open} onClose={onClose}>
            <div className="logout-confirm-modal">
                <Typography
                    text={dictionary.header_menu.logout_confirmation}
                    type="h2"
                    color={colors.gray10}
                />
                <Button
                    classname="logout-confirm-modal__button"
                    onPress={onConfirm}
                    title={dictionary.yes}
                    color="blue"
                    rounded
                    minimize={false}
                />
                <Button
                    classname="logout-confirm-modal__button"
                    onPress={onClose}
                    title={dictionary.no}
                    color="gray"
                    rounded
                    minimize={false}
                />
            </div>
        </Modal>
    );
};
