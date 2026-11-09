import {
    PropsWithChildren,
    ReactNode,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from 'react';
import { createPortal } from 'react-dom';
import { DotssIcon, CloseModalIcon } from '../../icons';

import './style.scss';
import classNames from 'classnames';
import { useHotkeys } from 'react-hotkeys-hook';
import { useIsMobile } from '../../hooks/useMobile';
import { DropdownCloseContext } from './context';

/** Зазор между меню и краем колонки, которая его обрезает */
const MENU_EDGE_GAP = 8;

/** Ближайший предок, который обрезает содержимое по горизонтали */
function horizontalClipOf(element: HTMLElement): HTMLElement | null {
    for (
        let parent = element.parentElement;
        parent && parent !== document.body;
        parent = parent.parentElement
    ) {
        if (getComputedStyle(parent).overflowX !== 'visible') {
            return parent;
        }
    }
    return null;
}

/**
 * GH-236: меню прижато правым краем к кнопке и растёт влево. Колонка
 * редактора с открытым менеджером файлов уже меню, и его левый край уходил
 * под обрезку колонки. Сколько места до её левого края, столько меню и
 * может занять, в пикселях раскладки: под масштабом окна они меньше экранных
 */
function availableMenuWidth(root: HTMLElement): number {
    const rootRect = root.getBoundingClientRect();
    const scale = root.offsetWidth > 0 ? rootRect.width / root.offsetWidth : 1;
    const clip = horizontalClipOf(root);
    const left = clip ? clip.getBoundingClientRect().left : 0;
    return (rootRect.right - left) / (scale || 1) - MENU_EDGE_GAP;
}

export const DropdownMenu = (
    props: PropsWithChildren<{
        icon?: ReactNode;
        inherit?: boolean;
        containerClassname?: string;
        clickable?: boolean;
        fullScreenOnMobile?: boolean;
    }>
) => {
    const [showMenu, setShowMenu] = useState(false);
    const [widthOfStopDefaulKistener, setWidth] = useState(0);
    const ref = useRef<HTMLDivElement>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const fullscreenRef = useRef<HTMLDivElement>(null);
    const isMobile = useIsMobile();
    const useFullScreen = Boolean(props.fullScreenOnMobile && isMobile);

    useEffect(() => {
        if (showMenu && ref.current && !widthOfStopDefaulKistener) {
            setWidth(ref.current.clientWidth);
        }
    }, [showMenu, widthOfStopDefaulKistener]);

    useEffect(() => {
        if (!showMenu || !useFullScreen) {
            return;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [showMenu, useFullScreen]);

    useEffect(() => {
        if (!showMenu) {
            return;
        }

        const onPointerDown = (event: PointerEvent) => {
            const target = event.target as Node;
            if (
                rootRef.current?.contains(target) ||
                fullscreenRef.current?.contains(target)
            ) {
                return;
            }
            setShowMenu(false);
        };

        document.addEventListener('pointerdown', onPointerDown);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
        };
    }, [showMenu]);

    const onHide = () => {
        setShowMenu(false);
    };

    const isMenuVisible = showMenu && props.children;
    const isPopover = Boolean(isMenuVisible) && !useFullScreen;
    const [constrainedWidth, setConstrainedWidth] = useState<number | null>(
        null
    );

    // до отрисовки: меню, которое не влезает, сразу появляется суженным
    useLayoutEffect(() => {
        const root = rootRef.current;
        const menu = ref.current;
        if (!isPopover || !root || !menu) {
            setConstrainedWidth(null);
            return;
        }
        const available = Math.floor(availableMenuWidth(root));
        setConstrainedWidth(menu.offsetWidth > available ? available : null);
    }, [isPopover]);

    useHotkeys(
        'esc',
        () => {
            if (!showMenu) {
                return;
            }
            onHide();
        },
        { enableOnFormTags: true }
    );

    const menuContent = (
        <DropdownCloseContext.Provider value={onHide}>
            <div
                ref={ref}
                className={classNames(
                    'dropdown-menu-content-container',
                    useFullScreen &&
                        'dropdown-menu-content-container--fullscreen',
                    constrainedWidth !== null &&
                        'dropdown-menu-content-container--constrained',
                    props.containerClassname
                )}
                style={
                    constrainedWidth !== null
                        ? { maxWidth: constrainedWidth }
                        : undefined
                }
            >
                {props.children}
            </div>
        </DropdownCloseContext.Provider>
    );

    const fullscreenOverlay =
        isMenuVisible && useFullScreen ? (
            <div ref={fullscreenRef} className="dropdown-menu-fullscreen">
                <div className="dropdown-menu-fullscreen__header">
                    <button
                        type="button"
                        className="dropdown-menu-fullscreen__close"
                        onClick={(event) => {
                            event.stopPropagation();
                            onHide();
                        }}
                        aria-label="Close"
                    >
                        <CloseModalIcon />
                    </button>
                </div>
                {menuContent}
            </div>
        ) : null;

    return (
        <div
            ref={rootRef}
            onMouseLeave={useFullScreen ? undefined : onHide}
            style={{ position: 'relative' }}
        >
            <div
                style={{
                    position: 'absolute',
                    right: 0,
                    height: 40,
                    width:
                        isMenuVisible && props.children && !useFullScreen
                            ? widthOfStopDefaulKistener
                            : undefined,
                }}
            ></div>
            <div
                className={classNames('dropdown-menu-container', {
                    active: isMenuVisible && !props.inherit && !useFullScreen,
                    'active-inherit':
                        isMenuVisible && props.inherit && !useFullScreen,
                })}
                onClick={() => {
                    if (props.clickable === undefined || props.clickable) {
                        setShowMenu(!showMenu);
                    }
                }}
            >
                {props.icon ? props.icon : <DotssIcon />}
            </div>
            {isMenuVisible
                ? useFullScreen
                    ? createPortal(fullscreenOverlay, document.body)
                    : menuContent
                : null}
        </div>
    );
};
