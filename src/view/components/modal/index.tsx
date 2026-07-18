import './style.scss';

import { ModalProps } from './model';
import { useHotkeys } from 'react-hotkeys-hook';
import { CloseModalIcon } from '../../icons';
import { useLayoutEffect, useRef } from 'react';

const focusableSelector = [
    '[data-autofocus]:not([disabled])',
    'button:not([disabled])',
    'input:not([disabled])',
    'textarea:not([disabled])',
    'select:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
].join(', ');

export const Modal = ({
    showModal,
    children,
    onClose,
    focusKey,
}: ModalProps) => {
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
    const modalRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (!showModal) {
            return;
        }

        const modal = modalRef.current;
        const focusableElement =
            modal?.querySelector<HTMLElement>(focusableSelector);

        (focusableElement ?? modal)?.focus();
    }, [showModal, focusKey]);

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
                ref={modalRef}
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
                className="modal-contaier"
            >
                {children}
            </div>
        </div>
    );
};
