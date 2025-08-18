import { useDispatch, useSelector } from 'react-redux';
import { useHotkeys } from 'react-hotkeys-hook';
import classNames from 'classnames';
import { InterfaceTourAnchorClassnames } from '../../../../../../components/tour/helpers';
import { HistoryChangerIcon } from '../../../../../../icons';

import './style.scss';
import {
    onNextVersionButtonClickedRequest,
    onPrevVersionButtonClickedRequest,
} from '../../../../../../../controller';
import {
    AppDispatch,
    StorageState,
} from '../../../../../../../viewModel/store';
import { useActiveElement } from '../../../../../../../viewModel/store/selectors/program.ts';

export const HistoryButtons = () => {
    const activeSegmentIndex = useSelector(useActiveElement);
    const dispatch = useDispatch<AppDispatch>();
    const undoEnabled = useSelector(
        (state: StorageState) => state.ide.undoEnabled
    );
    const redoEnabled = useSelector(
        (state: StorageState) => state.ide.redoEnabled
    );

    useHotkeys(
        'ctrl+z, cmd+z, shift+ctrl+z, shift+cmd+z',
        (e) => {
            if (activeSegmentIndex === undefined || activeSegmentIndex < 0) {
                e?.preventDefault();
                e?.stopPropagation();
                dispatch(onPrevVersionButtonClickedRequest());
            }
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
            if (activeSegmentIndex === undefined || activeSegmentIndex < 0) {
                e?.preventDefault();
                e?.stopPropagation();
                dispatch(onNextVersionButtonClickedRequest());
            }
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
                onClick={() => dispatch(onPrevVersionButtonClickedRequest())}
                className={classNames('history-button revert', {
                    disabled: !undoEnabled,
                })}
            >
                <HistoryChangerIcon />
            </div>
            <div
                onClick={() => dispatch(onNextVersionButtonClickedRequest())}
                className={classNames('history-button', {
                    disabled: !redoEnabled,
                })}
            >
                <HistoryChangerIcon />
            </div>
        </div>
    );
};
