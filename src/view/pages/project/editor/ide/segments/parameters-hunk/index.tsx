import { memo, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type {
    Hunk,
    ProgramRoundStrategy,
    Segment,
    SegmentParameterName,
} from '../../../../../../../model/domain.ts';
import {
    parameterChanges,
    parameterHunksForSegment,
    projectParameterChanges,
    projectParameterHunks,
    type ProjectParameterChange,
} from '../../../../../../../viewModel/utils/hunkGrouping.ts';
import type { Translations } from '../../../../../../../viewModel/dictionaries';
import { controller } from '../../../../../../../main.tsx';
import { AppDispatch, StorageState } from '../../../../../../store';
import { useDictionary } from '../../../../../../store/selectors/translations';
import { selectProjectParameters } from '../../../../../../store/selectors/hunks.ts';
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

/** Строка карточки: что за параметр, каким был и каким стал */
type ParameterChangeLine = {
    name: string;
    label: string;
    from: string;
    to: string;
};

const ParameterHunkCard = ({
    hunk,
    parameters,
}: {
    hunk: Hunk;
    parameters: Segment['parameters'] | undefined;
}) => {
    const dictionary = useSelector(useDictionary);
    const value = (flag: boolean) =>
        flag ? dictionary.hunks.parameter_yes : dictionary.hunks.parameter_no;
    const lines = parameterChanges(hunk.previousParameters, parameters).map(
        ({ name, from, to }) => ({
            name,
            label: dictionary.segment[PARAMETER_LABELS[name]] as string,
            from: value(from),
            to: value(to),
        })
    );
    return (
        <ParameterChangesCard
            hunkId={hunk.id}
            title={dictionary.hunks.parameters_changed}
            lines={lines}
            testId="parameters-hunk"
        />
    );
};

const ROUND_STRATEGY_LABELS: Record<
    ProgramRoundStrategy,
    keyof Translations['rounding_mode']
> = {
    noRound: 'without_round',
    oneDigit: 'one_digit',
    twoDigits: 'two_digits',
    threeDigits: 'three_digits',
    fiveDigits: 'five_digits',
    firstMeaningDigit: 'first_digit',
    twoMeaningDigits: 'two_meaning_digits',
    threeMeaningDigits: 'three_meaning_digits',
};

/** Подписи те же, что в меню проекта */
const projectChangeLine = (
    change: ProjectParameterChange,
    dictionary: Translations
): ParameterChangeLine => {
    switch (change.name) {
        case 'projectType': {
            const { from, to } =
                change as ProjectParameterChange<'projectType'>;
            const modes = dictionary.viewer.mode;
            return {
                name: change.name,
                label: modes.label,
                from: modes[from],
                to: modes[to],
            };
        }
        case 'roundStrategy': {
            const { from, to } =
                change as ProjectParameterChange<'roundStrategy'>;
            const rounding = dictionary.rounding_mode;
            // значение, которого фронт не знает, показываем как есть
            const label = (strategy: ProgramRoundStrategy) =>
                ROUND_STRATEGY_LABELS[strategy]
                    ? rounding[ROUND_STRATEGY_LABELS[strategy]]
                    : strategy;
            return {
                name: change.name,
                label: rounding.label,
                from: label(from),
                to: label(to),
            };
        }
        default: {
            const { from, to } =
                change as ProjectParameterChange<'latexCompiler'>;
            const compilers = dictionary.latex_compiler;
            return {
                name: change.name,
                label: compilers.label,
                from: compilers[from] ?? from,
                to: compilers[to] ?? to,
            };
        }
    }
};

/**
 * GH-284: агент сменил параметры проекта: округление, движок LaTeX, тип.
 * Места в документе у такой правки нет, поэтому карточка стоит в начале
 * документа, под LaTeX-заголовком, и в меню параметров проекта
 */
export const ProjectParameterHunks = memo(() => {
    const dictionary = useSelector(useDictionary);
    const hunks = useSelector((state: StorageState) => state.ide.hunks);
    const current = useSelector(selectProjectParameters);
    const shown = useMemo(() => projectParameterHunks(hunks), [hunks]);
    return (
        <>
            {shown.map((hunk) => (
                <ParameterChangesCard
                    key={hunk.id}
                    hunkId={hunk.id}
                    title={dictionary.hunks.project_parameters_changed}
                    lines={projectParameterChanges(
                        hunk.previousParameters,
                        current
                    ).map((change) => projectChangeLine(change, dictionary))}
                    testId="project-parameters-hunk"
                />
            ))}
        </>
    );
});

const ParameterChangesCard = ({
    hunkId,
    title,
    lines,
    testId,
}: {
    hunkId: string;
    title: string;
    lines: ParameterChangeLine[];
    testId: string;
}) => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const isAuthenticated = useSelector(
        (state: StorageState) => state.user.isAuthenticated
    );
    const pending = useSelector((state: StorageState) =>
        state.ide.pendingHunkIds.includes(hunkId)
    );
    // всё уже стоит как было: менять нечего, такой ханк примет сверка GH-179
    if (lines.length === 0) {
        return null;
    }
    const hunkIds = [hunkId];

    return (
        <div className="parameters-hunk" data-testid={testId}>
            <div className="parameters-hunk__body">
                <div className="parameters-hunk__title">{title}</div>
                <ul className="parameters-hunk__list">
                    {lines.map(({ name, label, from, to }) => (
                        <li
                            key={name}
                            className="parameters-hunk__item"
                            data-parameter={name}
                        >
                            {label}
                            {': '}
                            <s className="parameters-hunk__from">{from}</s>
                            {' → '}
                            <strong className="parameters-hunk__to">
                                {to}
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
