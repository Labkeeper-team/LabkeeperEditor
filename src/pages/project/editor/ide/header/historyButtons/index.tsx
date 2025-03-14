import { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHotkeys } from 'react-hotkeys-hook'
import classNames from 'classnames';
import { InterfaceTourAnchorClassnames } from '../../../../../../shared/components/tour/helpers';
import { HistoryChangerIcon } from '../../../../../../shared/icons';

import {
  useActiveSegmentIndex,
  useProgramHistory,
  useProgramHistoryActiveIndex,
} from '../../../../../../store/selectors/program';
import { setActiveIndex } from '../../../../../../store/slices/project';
import { setActiveSegmentIndex } from '../../../../../../store/slices/ide';

import './style.scss';

export const HistoryButtons = () => {
  const historyIndex = useSelector(useProgramHistoryActiveIndex);
  const activeIndex = useSelector(useActiveSegmentIndex());
  const history = useSelector(useProgramHistory);
  const historyLength = useMemo(() => history.length, [history]);
  const dispatch = useDispatch();


  const onPrevVersion = () => {
    if (activeIndex !== -1) {
      return;
    }
    dispatch(setActiveIndex(historyIndex - 1));
    dispatch(setActiveSegmentIndex(-1));
  };

  const onNextVersion = () => {
    if (activeIndex !== -1) {
      return;
    }
    dispatch(setActiveIndex(historyIndex + 1));
    dispatch(setActiveSegmentIndex(-1));
  };

  const onPrevDisabled = !historyLength || historyIndex === 0;
  const onNextDisabled =
    !historyLength ||
    historyIndex === history.length - 1 ||
    historyIndex === undefined;

    
  useHotkeys('ctrl+z', () => !onPrevDisabled ? onPrevVersion() : undefined, {enableOnFormTags: true, enableOnContentEditable: true}, [onPrevDisabled, activeIndex, historyIndex])
  useHotkeys('ctrl+y', () => !onNextDisabled ? onNextVersion() : undefined , {enableOnFormTags: true, enableOnContentEditable: true},  [onNextDisabled, activeIndex, historyIndex])

  return (
    <div
      className={classNames(
        InterfaceTourAnchorClassnames.HistoryCodeIde,
        'history-code-header-container'
      )}
    >
      <div
        onClick={onPrevDisabled ? undefined : onPrevVersion}
        className={classNames('history-button revert', {
          disabled: onPrevDisabled,
        })}
      >
        <HistoryChangerIcon />
      </div>
      <div
        onClick={onNextDisabled ? undefined : onNextVersion}
        className={classNames('history-button', { disabled: onNextDisabled })}
      >
        <HistoryChangerIcon />
      </div>
    </div>
  );
};
