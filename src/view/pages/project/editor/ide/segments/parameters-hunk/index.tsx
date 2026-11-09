import { memo, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type {
    Hunk,
    Segment,
    SegmentParameterName,
} from '../../../../../../../model/domain.ts';
import {
    parameterChanges,
    parameterHunksForSegment,
} from '../../../../../../../viewModel/utils/hunkGrouping.ts';
import type { Translations } from '../../../../../../../viewModel/dictionaries';
import { controller } from '../../../../../../../main.tsx';
import { AppDispatch, StorageState } from '../../../../../../store';
import { useDictionary } from '../../../../../../store/selectors/translations';
import './style.scss';

/** Подписи те же, что у флажков в меню сегмента */
const PARAMETER_LABELS: Record<
    SegmentParameterName,
    keyof Translations['segment']
> = {
    visible: 'visible',
    hideAssignment: 'hide_assignment',
    hideAssignmentWithValues: 'hide_assignment_with_values',
    hideValue: 'hide_value',
    hideGeneralFormula: 'hide_general_formula',
    hideInflAssignment: 'hide_infl_assignment',
    hideInflAssignmentWithValues: 'hide_infl_assignment_with_values',
    hideInfl: 'hide_infl',
};

/**
 * GH-242: агент сменил параметры сегмента. Строк у такой правки нет, поэтому
 * под сегментом карточка: какой параметр был и каким стал, с кнопками
 * принять и отклонить. Отклонение возвращает прежние значения
 */
export const SegmentParameterHunks = memo(
    ({
        segmentId,
        parameters,
    }: {
        segmentId: number;
        parameters: Segment['parameters'] | undefined;
    }) => {
        const hunks = useSelector((state: StorageState) => state.ide.hunks);
        const shown = useMemo(
            () => parameterHunksForSegment(hunks, segmentId),
            [hunks, segmentId]
        );
        if (shown.length === 0) {
            return null;
        }
        return (
            <>
                {shown.map((hunk) => (
                    <ParameterHunkCard
                        key={hunk.id}
                        hunk={hunk}
                        parameters={parameters}
                    />
                ))}
            </>
        );
    }
);

const ParameterHunkCard = ({
    hunk,
    parameters,
}: {
    hunk: Hunk;
    parameters: Segment['parameters'] | undefined;
}) => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const isAuthenticated = useSelector(
        (state: StorageState) => state.user.isAuthenticated
    );
    const pending = useSelector((state: StorageState) =>
        state.ide.pendingHunkIds.includes(hunk.id)
    );
    const changes = parameterChanges(hunk.previousParameters, parameters);
    // всё уже стоит как было: менять нечего, такой ханк примет сверка GH-179
    if (changes.length === 0) {
        return null;
    }
    const hunkIds = [hunk.id];
    const value = (flag: boolean) =>
        flag ? dictionary.hunks.parameter_yes : dictionary.hunks.parameter_no;

    return (
        <div className="parameters-hunk" data-testid="parameters-hunk">
            <div className="parameters-hunk__body">
                <div className="parameters-hunk__title">
                    {dictionary.hunks.parameters_changed}
                </div>
                <ul className="parameters-hunk__list">
                    {changes.map(({ name, from, to }) => (
                        <li
                            key={name}
                            className="parameters-hunk__item"
                            data-parameter={name}
                        >
                            {
                                dictionary.segment[
                                    PARAMETER_LABELS[name]
                                ] as string
                            }
                            {': '}
                            <s className="parameters-hunk__from">
                                {value(from)}
                            </s>
                            {' → '}
                            <strong className="parameters-hunk__to">
                                {value(to)}
                            </strong>
                        </li>
                    ))}
                </ul>
            </div>
            <div className="parameters-hunk__actions">
                <button
                    type="button"
                    className="segment-hunk-btn segment-hunk-btn--accept"
                    disabled={pending}
                    onClick={() =>
                        dispatch(controller.onHunkAcceptRequest({ hunkIds }))
                    }
                >
                    {pending ? (
                        <span className="segment-hunk-btn__spinner segment-hunk-btn__spinner--accept" />
                    ) : (
                        dictionary.hunks.accept
                    )}
                </button>
                {isAuthenticated ? (
                    <button
                        type="button"
                        className="segment-hunk-btn segment-hunk-btn--revert"
                        disabled={pending}
                        onClick={() =>
                            dispatch(
                                controller.onHunkRevertRequest({ hunkIds })
                            )
                        }
                    >
                        {pending ? (
                            <span className="segment-hunk-btn__spinner segment-hunk-btn__spinner--revert" />
                        ) : (
                            dictionary.hunks.revert
                        )}
                    </button>
                ) : null}
            </div>
        </div>
    );
};
