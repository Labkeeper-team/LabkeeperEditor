import './style.scss';

import { ModalProps } from './model';
import { useHotkeys } from 'react-hotkeys-hook';
import { CloseModalIcon } from '../../icons';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useIsMobile } from '../../hooks/useMobile';

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

const focusableSelector = [
    '[data-autofocus]:not([disabled])',
    'button:not([disabled])',
    'input:not([disabled])',
    'textarea:not([disabled])',
    'select:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
].join(', ');

const isEditableEventTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) {
        return false;
    }

    return Boolean(
        target.closest('input, textarea, select, [contenteditable="true"]')
    );
};

export const Modal = ({
    showModal,
    children,
    onClose,
    focusKey,
    closeable = true,
}: ModalProps) => {
    const isMobile = useIsMobile();

    useHotkeys(
        'esc',
        () => {
            onClose?.();
        },
        {
            enableOnFormTags: true,
            enabled: showModal && closeable,
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

    useEffect(() => {
        if (!showModal) {
            return;
        }

        const onWheel = (event: WheelEvent) => {
            event.preventDefault();
        };
        const onTouchMove = (event: TouchEvent) => {
            const target = event.target;
            if (target instanceof Node && modalRef.current?.contains(target)) {
                return;
            }
            event.preventDefault();
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (
                SCROLL_KEYS.has(event.key) &&
                !isEditableEventTarget(event.target)
            ) {
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

    const closeButton = closeable ? (
        <button
            type="button"
            className="close-button-container"
            onClick={onClose}
            aria-label="Close"
        >
            <CloseModalIcon />
        </button>
    ) : null;

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
                if (
                    closeable &&
                    isMouseDownOnOverlayRef.current &&
                    isPureOverlayTarget
                ) {
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
                if (
                    closeable &&
                    isMouseDownOnOverlayRef.current &&
                    isPureOverlayTarget
                ) {
                    onClose?.();
                }
                isMouseDownOnOverlayRef.current = false;
            }}
        >
            {!isMobile && closeButton}
            <div
                ref={modalRef}
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
                className="modal-contaier"
            >
                {isMobile && closeButton}
                {children}
            </div>
        </div>
    );
};
