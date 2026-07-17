import {
    PropsWithChildren,
    ReactNode,
    useEffect,
    useRef,
    useState,
} from 'react';
import { DotssIcon } from '../../icons';

import './style.scss';
import classNames from 'classnames';
import { useHotkeys } from 'react-hotkeys-hook';

export const DropdownMenu = (
    props: PropsWithChildren<{
        icon?: ReactNode;
        inherit?: boolean;
        containerClassname?: string;
        clickable?: boolean;
    }>
) => {
    const [showMenu, setShowMenu] = useState(false);
    const [widthOfStopDefaulKistener, setWidth] = useState(0);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (showMenu && ref.current && !widthOfStopDefaulKistener) {
            setWidth(ref.current.clientWidth);
        }
    }, [showMenu, widthOfStopDefaulKistener]);

    const onHide = () => {
        setShowMenu(false);
    };

    const isMenuVisible = showMenu && props.children;

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
    return (
        <div onMouseLeave={onHide} style={{ position: 'relative' }}>
            <div
                style={{
                    position: 'absolute',
                    right: 0,
                    height: 40,
                    width:
                        isMenuVisible && props.children
                            ? widthOfStopDefaulKistener
                            : undefined,
                }}
            ></div>
            <div
                className={classNames('dropdown-menu-container', {
                    active: isMenuVisible && !props.inherit,
                    'active-inherit': isMenuVisible && props.inherit,
                })}
                onClick={() => {
                    if (props.clickable === undefined || props.clickable) {
                        setShowMenu(!showMenu);
                    }
                }}
            >
                {props.icon ? props.icon : <DotssIcon />}
            </div>
            {isMenuVisible ? (
                <div
                    ref={ref}
                    className={classNames(
                        'dropdown-menu-content-container',
                        props.containerClassname
                    )}
                >
                    {props.children}
                </div>
            ) : null}
        </div>
    );
};
