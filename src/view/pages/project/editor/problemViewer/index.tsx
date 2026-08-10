import { useDispatch, useSelector } from 'react-redux';
import './style.scss';
import { useMemo } from 'react';
import { SectorHeader } from '../../../../components/littleSectorHeader';
import classNames from 'classnames';
import { InterfaceTourAnchorClassnames } from '../../../../components/tour/helpers';
import { useCompiledErrors } from '../../../../store/selectors/program';
import { colors } from '../../../../styles/colors';
import { useDictionary } from '../../../../store/selectors/translations';
import { CompileErrorResult } from '../../../../../model/domain';
import { ErrorGroupedItem } from './errorGroupItem';
import { AppDispatch, StorageState } from '../../../../store';
import { controller } from '../../../../../main.tsx';

type ErrorGroup = {
    key: string;
    segmentId: number | null;
    latexFile?: string | null;
    errors: CompileErrorResult[];
};

export const ProblemViewer = () => {
    const dispatch = useDispatch<AppDispatch>();
    const errors = useSelector(useCompiledErrors);
    const expanded = useSelector(
        (state: StorageState) => state.settings.expandProblemViewer
    );
    const dictionary = useSelector(useDictionary);

    const errorGroupedByLocation = useMemo(() => {
        if (!errors || !errors.length) {
            return [] as ErrorGroup[];
        }
        const groupedErrors: Map<string, ErrorGroup> = new Map();
        errors.forEach((error) => {
            const latexFile = error.payload.latexFile || null;
            const segmentId = latexFile ? null : error.payload.segmentId;
            const key = latexFile
                ? `file:${latexFile}`
                : segmentId == null
                  ? 'common'
                  : `segment:${segmentId}`;
            const existing = groupedErrors.get(key);
            if (existing) {
                existing.errors.push(error);
            } else {
                groupedErrors.set(key, {
                    key,
                    segmentId,
                    latexFile,
                    errors: [error],
                });
            }
        });

        const compareErrors = (
            a: CompileErrorResult,
            b: CompileErrorResult
        ) => {
            const lineA = Number.isNaN(+a.payload.line)
                ? Number.POSITIVE_INFINITY
                : a.payload.line;
            const lineB = Number.isNaN(+b.payload.line)
                ? Number.POSITIVE_INFINITY
                : b.payload.line;
            if (lineA !== lineB) {
                return lineA - lineB;
            }
            const posA = Number.isNaN(+a.payload.position)
                ? 0
                : a.payload.position;
            const posB = Number.isNaN(+b.payload.position)
                ? 0
                : b.payload.position;
            return posA - posB;
        };

        return Array.from(groupedErrors.values())
            .map((group) => ({
                ...group,
                errors: [...group.errors].sort(compareErrors),
            }))
            .sort((a, b) => {
                // Сегменты по номеру → файлы по пути → общие
                if (a.segmentId != null && b.segmentId != null) {
                    return a.segmentId - b.segmentId;
                }
                if (a.segmentId != null) {
                    return -1;
                }
                if (b.segmentId != null) {
                    return 1;
                }
                if (a.latexFile && b.latexFile) {
                    return a.latexFile.localeCompare(b.latexFile);
                }
                if (a.latexFile) {
                    return -1;
                }
                if (b.latexFile) {
                    return 1;
                }
                return 0;
            });
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
                onPressExpanded={() =>
                    dispatch(controller.onExpandErrorsClickedRequest())
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
