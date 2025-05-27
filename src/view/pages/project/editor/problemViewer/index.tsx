import { useDispatch, useSelector } from 'react-redux';
import './style.scss';
import { useMemo } from 'react';
import { SectorHeader } from '../../../../components/littleSectorHeader';
import classNames from 'classnames';
import { InterfaceTourAnchorClassnames } from '../../../../components/tour/helpers';
import { useCompiledErrors } from '../../../../../viewModel/store/selectors/program';
import { colors } from '../../../../styles/colors';
import { useDictionary } from '../../../../../viewModel/store/selectors/translations';
import { CompileErrorResult } from '../../../../../model/domain';
import { ErrorGroupedItem } from './errorGroupItem';
import { AppDispatch, StorageState } from '../../../../../viewModel/store';
import { onExpandErrorsClickedRequest } from '../../../../../controller';

type SegmentId = number;
export const ProblemViewer = () => {
    const dispatch = useDispatch<AppDispatch>();
    const errors = useSelector(useCompiledErrors);
    const expanded = useSelector(
        (state: StorageState) => state.settings.expandProblemViewer
    );
    const dictionary = useSelector(useDictionary);

    const errorGroupedBySegmentId = useMemo(() => {
        if (!errors || !errors.length) {
            return [];
        }
        const groupedErrors: Map<SegmentId, CompileErrorResult[]> = new Map();
        errors.forEach((error) => {
            const isGroupExist = groupedErrors.get(error.payload.segmentId);
            if (isGroupExist) {
                groupedErrors.set(error.payload.segmentId, [
                    ...isGroupExist,
                    error,
                ]);
            } else {
                groupedErrors.set(error.payload.segmentId, [error]);
            }
        });

        return Array.from(groupedErrors, ([segment, errors]) => ({
            segment,
            errors,
        }));
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
                onPressExpanded={() => dispatch(onExpandErrorsClickedRequest())}
                title={
                    <span className="header-problem-title">
                        {dictionary.label_problems}
                        <span
                            style={{
                                color: errors?.length
                                    ? colors.red10
                                    : undefined,
                            }}
                        >
                            ({errors?.length})
                        </span>
                    </span>
                }
            />
            <div
                className={classNames('problem-list', {
                    'problem-list-container-expanded': expanded,
                })}
            >
                {expanded
                    ? errorGroupedBySegmentId.map((erroGroupItem) => {
                          return (
                              <ErrorGroupedItem
                                  key={erroGroupItem.segment}
                                  segmentId={erroGroupItem.segment}
                                  errors={erroGroupItem.errors}
                              />
                          );
                      })
                    : null}
            </div>
        </div>
    );
};
