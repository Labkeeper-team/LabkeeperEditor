import { memo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import classNames from 'classnames';
import { AppDispatch, StorageState } from '../../store';
import { useDictionary } from '../../store/selectors/translations';
import { useIsProjectReadonly } from '../../store/selectors/program.ts';
import { controller } from '../../../main.tsx';
import {
    selectGroupedHunkCount,
    selectShouldShowGlobalHunkBar,
} from '../../store/selectors/hunks.ts';
import { ExpandIcon } from '../../icons';
import './hunkGlobalButtons.scss';

let hunkGlobalBarCollapsed = false;

export const HunkGlobalButtons = memo(() => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const isReadonly = useSelector(useIsProjectReadonly);
    const isAuthenticated = useSelector(
        (state: StorageState) => state.user.isAuthenticated
    );
    const hunks = useSelector((state: StorageState) => state.ide.hunks);
    const pendingHunkIds = useSelector(
        (state: StorageState) => state.ide.pendingHunkIds
    );
    const changeCount = useSelector(selectGroupedHunkCount);
    const showGlobalBar = useSelector(selectShouldShowGlobalHunkBar);
    const [collapsed, setCollapsed] = useState(hunkGlobalBarCollapsed);

    if (isReadonly || !showGlobalBar) {
        return null;
    }

    const pendingAll = hunks.some((h) => pendingHunkIds.includes(h.id));
    const totalChangesLabel = dictionary.hunks.total_changes.replace(
        '{n}',
        String(changeCount)
    );
    const toggleLabel = collapsed
        ? dictionary.hunks.expand_bar
        : dictionary.hunks.collapse_bar;

    return (
        <div
            className={classNames('hunk-global-bar', {
                'hunk-global-bar--collapsed': collapsed,
            })}
        >
            <div
                className={classNames('hunk-global-bar__inner', {
                    'hunk-global-bar__inner--collapsed': collapsed,
                })}
            >
                <button
                    type="button"
                    className="hunk-global-bar__toggle"
                    aria-label={toggleLabel}
                    aria-expanded={!collapsed}
                    title={toggleLabel}
                    onClick={() => {
                        const next = !collapsed;
                        hunkGlobalBarCollapsed = next;
                        setCollapsed(next);
                    }}
                >
                    <ExpandIcon
                        className={classNames('hunk-global-bar__toggle-icon', {
                            'hunk-global-bar__toggle-icon--collapsed':
                                collapsed,
                        })}
                    />
                </button>
                {collapsed ? null : (
                    <>
                        <span className="hunk-global-bar__label">
                            {totalChangesLabel}
                        </span>
                        <div className="hunk-global-bar__actions">
                            <button
                                type="button"
                                className="hunk-global-btn hunk-global-btn--accept"
                                disabled={pendingAll}
                                onClick={() =>
                                    dispatch(
                                        controller.onHunkAcceptAllRequest()
                                    )
                                }
                            >
                                {pendingAll ? (
                                    <span className="hunk-global-btn__spinner hunk-global-btn__spinner--accept" />
                                ) : (
                                    dictionary.hunks.accept_all
                                )}
                            </button>
                            {isAuthenticated ? (
                                <button
                                    type="button"
                                    className="hunk-global-btn hunk-global-btn--revert"
                                    disabled={pendingAll}
                                    onClick={() =>
                                        dispatch(
                                            controller.onHunkRevertAllRequest()
                                        )
                                    }
                                >
                                    {pendingAll ? (
                                        <span className="hunk-global-btn__spinner hunk-global-btn__spinner--revert" />
                                    ) : (
                                        dictionary.hunks.revert_all
                                    )}
                                </button>
                            ) : null}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
});

HunkGlobalButtons.displayName = 'HunkGlobalButtons';
