import './style.scss';

import { ModalProps } from './model';
import { useHotkeys } from 'react-hotkeys-hook';
import { CloseModalIcon } from '../../icons';
import { useEffect, useRef } from 'react';

const SCROLL_KEYS = new Set([
    ' ',
    'Spacebar',
    'PageUp',
    'PageDown',
    'End',
    'Home',
    'ArrowUp',
    'ArrowDown',
]);

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

    useEffect(() => {
        if (!showModal) {
            return;
        }

        const onWheel = (event: WheelEvent) => {
            event.preventDefault();
        };
        const onTouchMove = (event: TouchEvent) => {
            event.preventDefault();
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (SCROLL_KEYS.has(event.key)) {
                event.preventDefault();
            }
        };

        window.addEventListener('wheel', onWheel, { passive: false });
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('keydown', onKeyDown, { passive: false });

        return () => {
            window.removeEventListener('wheel', onWheel);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [showModal]);

    if (!showModal) {
        return null;
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
