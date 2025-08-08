import { useDispatch, useSelector } from 'react-redux';
import { useHotkeys } from 'react-hotkeys-hook';
import classNames from 'classnames';
import { InterfaceTourAnchorClassnames } from '../../../../../../components/tour/helpers';
import { HistoryChangerIcon } from '../../../../../../icons';

import './style.scss';
import {
    isNextVersionButtonDisabledRequest,
    isPrevVersionButtonDisabledRequest,
    onNextVersionButtonClickedRequest,
    onPrevVersionButtonClickedRequest,
} from '../../../../../../../controller';
import { AppDispatch } from '../../../../../../../viewModel/store';
import { useActiveElement } from '../../../../../../../viewModel/store/selectors/program.ts';

export const HistoryButtons = () => {
    const dispatch = useDispatch<AppDispatch>();
    const activeSegmentIndex = useSelector(useActiveElement);

    useHotkeys(
        'ctrl+z',
        () => {
            if (!activeSegmentIndex || activeSegmentIndex < 0) {
                dispatch(onPrevVersionButtonClickedRequest());
            }
        },
        {
            enableOnFormTags: true,
            enableOnContentEditable: true,
        }
    );
    useHotkeys(
        'ctrl+y',
        () => {
            if (!activeSegmentIndex || activeSegmentIndex < 0) {
                dispatch(onNextVersionButtonClickedRequest());
            }
        },
        {
            enableOnFormTags: true,
            enableOnContentEditable: true,
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
                    disabled: isPrevVersionButtonDisabledRequest(),
                })}
            >
                <HistoryChangerIcon />
            </div>
            <div
                onClick={() => dispatch(onNextVersionButtonClickedRequest())}
                className={classNames('history-button', {
                    disabled: isNextVersionButtonDisabledRequest(),
                })}
            >
                <HistoryChangerIcon />
            </div>
        </div>
    );
};
