import { useDispatch, useSelector } from 'react-redux';
import './style.scss';
import { useEffect, useMemo } from 'react';
import { SectorHeader } from '../../../../shared/components/littleSectorHeader';
import classNames from 'classnames';
import { InterfaceTourAnchorClassnames } from '../../../../shared/components/tour/helpers';
import { useCompiledErrors } from '../../../../store/selectors/program';
import { colors } from '../../../../shared/styles/colors';
import { useDictionary } from '../../../../store/selectors/translations';
import { CompileErrorResult } from '../../../../shared/models/project';
import { ErrorGroupedItem } from './errorGroupItem';
import { StorageState } from '../../../../store';
import { setExpandProblemViewer } from '../../../../store/slices/settings';

type SegmentId = number;
export const ProblemViewer = () => {
  const dispatch = useDispatch();
  const errors = useSelector(useCompiledErrors);
  const expanded = useSelector((state: StorageState) => state.settings.expandProblemViewer);
  const dictionary = useSelector(useDictionary);

  const onClick = () => {
    dispatch(setExpandProblemViewer(!expanded));
  };

  useEffect(() => {
    if (errors?.length) {
      dispatch(setExpandProblemViewer(true));
    }
  }, [errors]);


  const errorGroupedBySegmentId = useMemo(() => {
    if (!errors || !errors.length) {
      return [];
    }
    const groupedErrors: Map<SegmentId, CompileErrorResult[]> = new Map();
    errors.forEach(error => {
      const isGroupExist = groupedErrors.get(error.payload.segmentId);
      if (isGroupExist) {
        groupedErrors.set(error.payload.segmentId, [...isGroupExist, error]);
      } else {
        groupedErrors.set(error.payload.segmentId, [error]);
      }
    });

    return Array.from(groupedErrors, ([segment, errors]) => ({ segment, errors }));
  }, [errors]);

  return (
    <div
      className={classNames(
        'labkeeper-problem-viewer-container',
        InterfaceTourAnchorClassnames.Problems
      )}
    >
      <SectorHeader
        expanded={expanded}
        onPressExpanded={onClick}
        title={<span className='header-problem-title'>
          {dictionary.label_problems}
          <span style={{color: errors?.length ? colors.red10 : undefined}}>
            ({errors?.length})
            </span>
          </span>}
      />
      <div
        className={classNames('problem-list', {
          'problem-list-container-expanded': expanded,
        })}
      >
        {expanded
          ? errorGroupedBySegmentId.map(erroGroupItem => {
            return <ErrorGroupedItem key={erroGroupItem.segment} segmentId={erroGroupItem.segment} errors={erroGroupItem.errors} />
          })
          : null}
      </div>
    </div>
  );
};
