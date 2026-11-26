import { Fragment, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import classNames from 'classnames';
import { AppDispatch, StorageState } from '../../../../store';
import { controller } from '../../../../../main.tsx';
import { useDictionary } from '../../../../store/selectors/translations.ts';
import {
    useCurrentProgram,
    useIsAgentRunning,
    useIsProjectReadonly,
} from '../../../../store/selectors/program.ts';
import { InfoIcon, WarningIcon } from '../../../../icons';
import {
    isTexDocumentPart,
    texEntryPointStatus,
    texIncludeLine,
} from '../../../../../viewModel/utils/texEntryPoint.ts';

/** Текст словаря с {input}, где строка \input показывается кодом */
const withInputCode = (text: string, input: string) =>
    text.split('{input}').map((part, index) => (
        <Fragment key={index}>
            {index > 0 ? (
                <code className="tex-entry-note__code">{input}</code>
            ) : null}
            {part}
        </Fragment>
    ));

/**
 * GH-246: над файлом .tex строка о том, что PDF собирается из сегментов, и
 * подключён ли в них этот файл. Без неё человек правил файл, в том числе свой
 * main.tex, и не понимал, почему PDF не меняется
 */
export const TexEntryNote = ({ file }: { file: string }) => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const program = useSelector(useCurrentProgram);
    const isLatexMode = useSelector(
        (state: StorageState) => state.project.mode === 'latex'
    );
    const isAuth = useSelector(
        (state: StorageState) => state.user.isAuthenticated
    );
    const isReadonly = useSelector(useIsProjectReadonly);
    const isAgentRunning = useSelector(useIsAgentRunning);

    const status = useMemo(
        () => texEntryPointStatus(program?.segments ?? [], file),
        [program, file]
    );

    // в проекте Markdown LaTeX не компилируется, сегментам там нечего подключать
    if (!isLatexMode || !isTexDocumentPart(file)) {
        return null;
    }

    const texts = dictionary.tex_entry_note;
    const input = texIncludeLine(file);
    const canEdit = isAuth && !isReadonly && !isAgentRunning;

    return (
        <div
            className={classNames(
                'tex-entry-note',
                `tex-entry-note--${status.kind}`
            )}
            role="note"
        >
            <span className="tex-entry-note__icon" aria-hidden>
                {status.kind === 'replacedByMain' ? (
                    <WarningIcon />
                ) : (
                    <InfoIcon />
                )}
            </span>
            <span className="tex-entry-note__text">
                {status.kind === 'replacedByMain'
                    ? texts.replaced_by_main
                    : status.kind === 'included'
                      ? texts.included.replace(
                            '{segment}',
                            String(status.segmentIndex + 1)
                        )
                      : withInputCode(texts.not_included, input)}
            </span>
            {status.kind === 'included' ? (
                <button
                    type="button"
                    className="tex-entry-note__action"
                    onClick={() =>
                        dispatch(
                            controller.onShowSegmentLineRequest({
                                segmentIndex: status.segmentIndex,
                                line: status.line,
                            })
                        )
                    }
                >
                    {texts.show}
                </button>
            ) : null}
            {status.kind === 'notIncluded' && canEdit ? (
                <button
                    type="button"
                    className="tex-entry-note__action"
                    title={texts.include_hint.replace('{input}', input)}
                    onClick={() =>
                        dispatch(
                            controller.onIncludeTextFileInSegmentsRequest({
                                file,
                            })
                        )
                    }
                >
                    {texts.include}
                </button>
            ) : null}
        </div>
    );
};
