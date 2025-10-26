import { useDispatch, useSelector } from 'react-redux';
import { useEffect, useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import classNames from 'classnames';
import { InterfaceTourAnchorClassnames } from '../../../../../../components/tour/helpers';
import { HistoryChangerIcon } from '../../../../../../icons';
import { CheckIcon, WarningIcon } from '../../../../../../icons';

import './style.scss';
import { AppDispatch, StorageState } from '../../../../../../store';
import { controller } from '../../../../../../../controller.tsx';

export const HistoryButtons = () => {
    const dispatch = useDispatch<AppDispatch>();
    const undoEnabled = useSelector(
        (state: StorageState) => state.ide.undoEnabled
    );
    const redoEnabled = useSelector(
        (state: StorageState) => state.ide.redoEnabled
    );
    const isAuth = useSelector(
        (state: StorageState) => state.user.isAuthenticated
    );
    const saveProjectRequestState = useSelector(
        (state: StorageState) => state.ide.saveProjectRequestState
    );

    // Показываем спиннер минимум 500 мс
    const [showLoading, setShowLoading] = useState(false);
    const loadingStartRef = useRef<number | null>(null);
    const hideTimerRef = useRef<number | null>(null);

    useEffect(() => {
        if (saveProjectRequestState === 'loading') {
            setShowLoading(true);
            loadingStartRef.current = performance.now();
            if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
                hideTimerRef.current = null;
            }
            return;
        }

        // Если выходим из loading — ждём минимум 500 мс общего времени
        if (showLoading) {
            const startedAt = loadingStartRef.current ?? performance.now();
            const elapsed = performance.now() - startedAt;
            const remain = 500 - elapsed;
            if (remain > 0) {
                hideTimerRef.current = window.setTimeout(() => {
                    setShowLoading(false);
                    hideTimerRef.current = null;
                }, remain);
            } else {
                setShowLoading(false);
            }
        } else {
            setShowLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [saveProjectRequestState]);

    useEffect(() => {
        return () => {
            if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
            }
        };
    }, []);

    useHotkeys(
        'ctrl+z, cmd+z, shift+ctrl+z, shift+cmd+z',
        (e) => {
            e?.preventDefault();
            e?.stopPropagation();
            dispatch(controller.onPrevVersionButtonClickedRequest());
        },
        {
            enableOnFormTags: true,
            enableOnContentEditable: true,
            preventDefault: true,
        }
    );
    useHotkeys(
        'ctrl+y, cmd+shift+z',
        (e) => {
            e?.preventDefault();
            e?.stopPropagation();
            dispatch(controller.onNextVersionButtonClickedRequest());
        },
        {
            enableOnFormTags: true,
            enableOnContentEditable: true,
            preventDefault: true,
        }
    );

    return (
        <div
            className={classNames(
                InterfaceTourAnchorClassnames.HistoryCodeIde,
                'history-code-header-container'
            )}
        >
            <div
                onClick={() =>
                    dispatch(controller.onPrevVersionButtonClickedRequest())
                }
                className={classNames('history-button revert', {
                    disabled: !undoEnabled,
                })}
            >
                <HistoryChangerIcon />
            </div>
            <div
                onClick={() =>
                    dispatch(controller.onNextVersionButtonClickedRequest())
                }
                className={classNames('history-button', {
                    disabled: !redoEnabled,
                })}
            >
                <HistoryChangerIcon />
            </div>
            {isAuth && (
                <div className="save-status" aria-label="save-status">
                    {(() => {
                        if (showLoading) {
                            return (
                                <span className="ide-clone-spinner center-icon" />
                            );
                        }
                        if (saveProjectRequestState === 'error') {
                            return (
                                <div className="center-icon">
                                    <WarningIcon />
                                </div>
                            );
                        }
                        return (
                            <div className="center-icon">
                                <CheckIcon />
                            </div>
                        );
                    })()}
                </div>
            )}
        </div>
    );
};
