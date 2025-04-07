import './style.scss';

import { ModalProps } from './model';
import { useHotkeys } from 'react-hotkeys-hook';
import { CloseModalIcon } from '../../icons';

export const Modal = ({ showModal, children, onClose }: ModalProps) => {
    useHotkeys(
        'esc',
        () => {
            onClose?.();
        },
        {
            enableOnFormTags: true,
        }
    );

    if (!showModal) {
        return;
    }

    return (
        <div onClick={onClose} className="modal-container-overlay">
            <div className="close-button-container">
                <CloseModalIcon />
            </div>
            <div
                onClick={(e) => e.stopPropagation()}
                className="modal-contaier"
            >
                {children}
            </div>
        </div>
    );
};
