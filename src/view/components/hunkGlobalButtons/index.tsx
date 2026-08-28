import { memo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, StorageState } from '../../store';
import { useDictionary } from '../../store/selectors/translations';
import { useIsMobile } from '../../hooks/useMobile';
import { useIsProjectReadonly } from '../../store/selectors/program.ts';
import { controller } from '../../../main.tsx';
import {
    selectGroupedHunkCount,
    selectShouldShowGlobalHunkBar,
} from '../../store/selectors/hunks.ts';
import './hunkGlobalButtons.scss';

export const HunkGlobalButtons = memo(() => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const isMobile = useIsMobile();
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

    if (isMobile || isReadonly || !showGlobalBar) {
        return null;
    }

    const pendingAll = hunks.some((h) => pendingHunkIds.includes(h.id));
    const totalChangesLabel = dictionary.hunks.total_changes.replace(
        '{n}',
        String(changeCount)
    );

    return (
        <div className="hunk-global-bar">
            <div className="hunk-global-bar__inner">
                <span className="hunk-global-bar__label">
                    {totalChangesLabel}
                </span>
                <div className="hunk-global-bar__actions">
                    <button
                        type="button"
                        className="hunk-global-btn hunk-global-btn--accept"
                        disabled={pendingAll}
                        onClick={() =>
                            dispatch(controller.onHunkAcceptAllRequest())
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
                                dispatch(controller.onHunkRevertAllRequest())
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
            </div>
        </div>
    );
});

HunkGlobalButtons.displayName = 'HunkGlobalButtons';
