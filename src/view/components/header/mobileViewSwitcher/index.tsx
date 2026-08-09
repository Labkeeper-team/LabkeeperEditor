import classNames from 'classnames';
import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';

import { useDictionary } from '../../../store/selectors/translations';
import { useMobileView } from '../../../store/selectors/program';
import { AppDispatch } from '../../../store';
import { setMobileView } from '../../../store/slices/settings';
import { controller } from '../../../../main.tsx';
import { useIsMobile } from '../../../hooks/useMobile';

import './style.scss';

export const MobileViewSwitcher = () => {
    const dispatch = useDispatch<AppDispatch>();
    const location = useLocation();
    const dictionary = useSelector(useDictionary);
    const mobileView = useSelector(useMobileView);
    const isMobile = useIsMobile();
    const [open, setOpen] = useState(false);
    const barRef = useRef<HTMLDivElement>(null);

    const isProjectPage = location.pathname.startsWith('/project/');

    useEffect(() => {
        if (!open) {
            return;
        }

        const onPointerDown = (event: PointerEvent) => {
            if (!barRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        document.addEventListener('pointerdown', onPointerDown);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
        };
    }, [open]);

    if (!isMobile || !isProjectPage) {
        return null;
    }

    const views = [
        { id: 'files' as const, label: dictionary.mobile_view.files },
        { id: 'editor' as const, label: dictionary.mobile_view.editor },
        { id: 'pdf' as const, label: dictionary.mobile_view.pdf },
    ];

    const currentView = views.find((view) => view.id === mobileView);

    const onSelectView = (id: 'files' | 'editor' | 'pdf') => {
        if (id === 'files') {
            dispatch(controller.onFolderButtonClickedRequest());
        }
        dispatch(setMobileView(id));
        setOpen(false);
    };

    return (
        <div className="mobile-view-switcher-bar" ref={barRef}>
            <button
                type="button"
                className="mobile-view-switcher-bar__toggle"
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
            >
                <span className="mobile-view-switcher-bar__label">
                    {currentView?.label ?? dictionary.mobile_view.editor}
                </span>
                <span
                    className={classNames('mobile-view-switcher-bar__chevron', {
                        'mobile-view-switcher-bar__chevron--open': open,
                    })}
                    aria-hidden
                />
            </button>
            {open ? (
                <div
                    className="mobile-view-switcher-bar__options"
                    role="listbox"
                >
                    {views.map(({ id, label }) => (
                        <button
                            key={id}
                            type="button"
                            role="option"
                            aria-selected={mobileView === id}
                            className={classNames(
                                'mobile-view-switcher-bar__option',
                                {
                                    'mobile-view-switcher-bar__option--active':
                                        mobileView === id,
                                }
                            )}
                            onClick={() => onSelectView(id)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
};
