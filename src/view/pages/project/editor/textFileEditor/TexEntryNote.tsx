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
    texEntryNoteKind,
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
 * GH-246: полоса над файлом .tex для новичка, который правит файл и не
 * понимает, почему PDF не меняется. Над main.tex в корне она предупреждает,
 * что сегменты при нём не учитываются. Над другим файлом она предлагает
 * подключить его, пока сегменты не подключают ни одного файла
 */
export const TexEntryNote = ({ file }: { file: string }) => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const program = useSelector(useCurrentProgram);
    const files = useSelector((state: StorageState) => state.project.files);
    const isLatexMode = useSelector(
        (state: StorageState) => state.project.mode === 'latex'
    );
    const isAuth = useSelector(
        (state: StorageState) => state.user.isAuthenticated
    );
    const isReadonly = useSelector(useIsProjectReadonly);
    const isAgentRunning = useSelector(useIsAgentRunning);

    const kind = useMemo(
        () =>
            texEntryNoteKind(
                program?.segments ?? [],
                files.map((item) => item.fileName),
                file
            ),
        [program, files, file]
    );

    // в проекте Markdown LaTeX не компилируется, сегментам там нечего подключать
    if (!isLatexMode || !kind) {
        return null;
    }

    const texts = dictionary.tex_entry_note;
    const input = texIncludeLine(file);
    const canEdit = isAuth && !isReadonly && !isAgentRunning;

    return (
        <div
            className={classNames('tex-entry-note', `tex-entry-note--${kind}`)}
            role="note"
        >
            <span className="tex-entry-note__icon" aria-hidden>
                {kind === 'mainIgnoresSegments' ? (
                    <WarningIcon />
                ) : (
                    <InfoIcon />
                )}
            </span>
            <span className="tex-entry-note__text">
                {kind === 'mainIgnoresSegments'
                    ? texts.main_ignores_segments
                    : withInputCode(texts.not_included, input)}
            </span>
            {kind === 'suggestInclude' && canEdit ? (
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
