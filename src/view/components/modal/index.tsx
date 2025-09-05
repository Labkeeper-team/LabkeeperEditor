import './style.scss';

import { ModalProps } from './model';
import { useHotkeys } from 'react-hotkeys-hook';
import { CloseModalIcon } from '../../icons';
import { useRef } from 'react';

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

    const isMouseDownOnOverlayRef = useRef(false);

    if (!showModal) {
        return;
    }

    return (
        <div
            className="modal-container-overlay"
            onMouseDown={(e) => {
                isMouseDownOnOverlayRef.current = e.currentTarget === e.target;
            }}
            onMouseMove={() => {
                // Любое движение после нажатия отменяет "чистый" клик
                if (isMouseDownOnOverlayRef.current) {
                    isMouseDownOnOverlayRef.current = false;
                }
            }}
            onMouseUp={(e) => {
                const isPureOverlayTarget = e.currentTarget === e.target;
                if (isMouseDownOnOverlayRef.current && isPureOverlayTarget) {
                    onClose?.();
                }
                isMouseDownOnOverlayRef.current = false;
            }}
            onTouchStart={(e) => {
                isMouseDownOnOverlayRef.current = e.currentTarget === e.target;
            }}
            onTouchMove={() => {
                if (isMouseDownOnOverlayRef.current) {
                    isMouseDownOnOverlayRef.current = false;
                }
            }}
            onTouchEnd={(e) => {
                const isPureOverlayTarget = e.currentTarget === e.target;
                if (isMouseDownOnOverlayRef.current && isPureOverlayTarget) {
                    onClose?.();
                }
                isMouseDownOnOverlayRef.current = false;
            }}
        >
            <div className="close-button-container" onClick={onClose}>
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
