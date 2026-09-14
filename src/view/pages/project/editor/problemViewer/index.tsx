import { useDispatch, useSelector } from 'react-redux';
import './style.scss';
import { useMemo } from 'react';
import { SectorHeader } from '../../../../components/littleSectorHeader';
import classNames from 'classnames';
import { InterfaceTourAnchorClassnames } from '../../../../components/tour/helpers';
import {
    useCompiledErrors,
    useIsProjectReadonly,
} from '../../../../store/selectors/program';
import { colors } from '../../../../styles/colors';
import { useDictionary } from '../../../../store/selectors/translations';
import { groupCompileErrors } from '../../../../../viewModel/utils/compileErrors.ts';
import { ErrorGroupedItem } from './errorGroupItem';
import { AppDispatch, StorageState } from '../../../../store';
import { controller } from '../../../../../main.tsx';

export const ProblemViewer = () => {
    const dispatch = useDispatch<AppDispatch>();
    const errors = useSelector(useCompiledErrors);
    const expanded = useSelector(
        (state: StorageState) => state.settings.expandProblemViewer
    );
    const dictionary = useSelector(useDictionary);
    // на чужом проекте чата нет, отправлять ошибки некуда
    const isReadonly = useSelector(useIsProjectReadonly);
    const canSendToAgent = Boolean(errors?.length) && !isReadonly;

    const errorGroupedByLocation = useMemo(
        () => groupCompileErrors(errors),
        [errors]
    );

    return (
        <div
            className={classNames(
                'labkeeper-problem-viewer-container',
                InterfaceTourAnchorClassnames.Problems
            )}
        >
            <SectorHeader
                expanded={expanded}
                onPressExpanded={() =>
                    dispatch(controller.onExpandErrorsClickedRequest())
                }
                actions={
                    canSendToAgent ? (
                        <button
                            type="button"
                            className="problem-viewer-send-to-agent"
                            onClick={() =>
                                dispatch(
                                    controller.onSendErrorsToAgentRequest()
                                )
                            }
                        >
                            {dictionary.agent_chat.send_errors}
                        </button>
                    ) : undefined
                }
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
                    ? errorGroupedByLocation.map((erroGroupItem) => {
                          return (
                              <ErrorGroupedItem
                                  key={erroGroupItem.key}
                                  segmentId={erroGroupItem.segmentId}
                                  latexFile={erroGroupItem.latexFile}
                                  errors={erroGroupItem.errors}
                              />
                          );
                      })
                    : null}
            </div>
        </div>
    );
};
