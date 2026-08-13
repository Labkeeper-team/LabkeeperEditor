import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CodeMirror, {
    Decoration,
    EditorView,
    ReactCodeMirrorRef,
    StateEffect,
    StateField,
    Range,
} from '@uiw/react-codemirror';
import { DecorationSet } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { latex } from 'codemirror-lang-latex';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, StorageState } from '../../../../store';
import { controller } from '../../../../../main.tsx';
import { useIsProjectReadonly } from '../../../../store/selectors/program.ts';
import { CheckIcon, PlusIcon, WarningIcon } from '../../../../icons';
import {
    refreshCodeMirrorLayout,
    syncCodeMirrorLayout,
} from '../../../../utils/refreshCodeMirrorLayout';
import { textFileEditorWheelScroll } from './textFileEditorWheelScroll';
import { isLatexTextFilePath } from '../../fileManager/svarFileTreeAdapter.ts';
import { RunButton } from '../runButton';
import {
    setActiveEditorLine,
    setEditorNavigationTarget,
    setSynctexEditorPosition,
} from '../../../../store/slices/ide';
import { CompileErrorResult } from '../../../../../model/domain';
import {
    projectFilePathsMatch,
    resolveProjectFileName,
} from '../../../../../viewModel/utils/projectFilePath.ts';
import {
    scrollTextFileEditorLineIntoView,
    TEXT_FILE_EDITOR_HOST_ID,
} from './textFileEditorView';
import '../ide/style.scss';
import '../ide/header/style.scss';
import './style.scss';

/** Fallback для обычных текстовых файлов без языкового режима. */
const TEXT_FILE_PLAIN_TEXT_HIGHLIGHT = syntaxHighlighting(
    HighlightStyle.define([], { all: { color: '#000' } }),
    { fallback: true }
);

const TEXT_FILE_EDITOR_BASIC_SETUP = {
    lineNumbers: true,
    foldGutter: false,
    highlightSelectionMatches: false,
    highlightActiveLine: false,
    highlightActiveLineGutter: false,
} as const;

const TEXT_FILE_EDITOR_THEME = EditorView.theme({
    '.cm-content': {
        color: '#000',
    },
    '.cm-scroller': {
        overflowX: 'hidden',
    },
    '.highlight-text-editor-error': {
        textDecoration: 'underline',
        textDecorationLine: 'spelling-error',
        textDecorationColor: 'red',
    },
});

const setDecorationsEffect = StateEffect.define<DecorationSet>();

const decorationsField = StateField.define<DecorationSet>({
    create() {
        return Decoration.none;
    },
    update(value, tr) {
        let next = value.map(tr.changes);
        for (const effect of tr.effects) {
            if (effect.is(setDecorationsEffect)) {
                next = effect.value;
            }
        }
        return next;
    },
    provide: (field) => EditorView.decorations.from(field),
});

function applyErrorDecorations(view: EditorView, errors: CompileErrorResult[]) {
    const docText = view.state.doc.toString();
    const decorations: Range<Decoration>[] = [];
    if (errors.length) {
        const lines = docText.split('\n');
        const sorted = [...errors].sort(
            (a, b) => a.payload.line - b.payload.line
        );
        sorted.forEach((error) => {
            // latexFile: line 1-based → индекс строки 0-based
            const lineIndex = Math.max(0, error.payload.line - 1);
            if (lineIndex >= lines.length) {
                return;
            }
            const row = lines[lineIndex];
            const startIndex = lines
                .slice(0, lineIndex)
                .reduce((total, cur) => total + cur.length + 1, 0);
            const endIndex = startIndex + (row?.length || 1);
            if (
                startIndex >= 0 &&
                endIndex > startIndex &&
                endIndex <= docText.length
            ) {
                decorations.push(
                    Decoration.mark({
                        class: 'highlight-text-editor-error',
                    }).range(startIndex, endIndex)
                );
            }
        });
    }
    decorations.sort((a, b) => a.from - b.from);
    view.dispatch({
        effects: setDecorationsEffect.of(
            decorations.length ? Decoration.set(decorations) : Decoration.none
        ),
    });
}

function getCompileErrorsFingerprint(
    errors: CompileErrorResult[] | undefined
): string {
    if (!errors?.length) {
        return '';
    }
    return errors
        .map(
            (error) =>
                `${error.code}:${error.payload.line}:${error.payload.position}:${error.payload.latexFile ?? ''}:${error.payload.segmentId ?? ''}`
        )
        .join('|');
}

export const TextFileEditor = () => {
    const dispatch = useDispatch<AppDispatch>();
    const activeTextFile = useSelector(
        (state: StorageState) => state.ide.activeTextFile
    );
    const textFileContent = useSelector(
        (state: StorageState) => state.ide.textFileContent
    );
    const loadTextFileRequestState = useSelector(
        (state: StorageState) => state.ide.loadTextFileRequestState
    );
    const saveTextFileRequestState = useSelector(
        (state: StorageState) => state.ide.saveTextFileRequestState
    );
    const compileErrors = useSelector(
        (state: StorageState) => state.project.compileErrorResult?.errors
    );
    const projectFiles = useSelector(
        (state: StorageState) => state.project.files
    );
    const editorNavigationTarget = useSelector(
        (state: StorageState) => state.ide.editorNavigationTarget
    );
    const isReadonly = useSelector(useIsProjectReadonly);
    const isAuth = useSelector(
        (state: StorageState) => state.user.isAuthenticated
    );
    const bodyRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<ReactCodeMirrorRef>(null);
    const [editorHeight, setEditorHeight] = useState(0);
    const [editorViewEpoch, setEditorViewEpoch] = useState(0);
    const [showSaveLoading, setShowSaveLoading] = useState(false);
    const saveLoadingStartRef = useRef<number | null>(null);
    const saveHideTimerRef = useRef<number | null>(null);
    const [dismissedErrorsFingerprint, setDismissedErrorsFingerprint] =
        useState<string | null>(null);

    const errorsFingerprint = useMemo(
        () => getCompileErrorsFingerprint(compileErrors),
        [compileErrors]
    );

    const fileTempErrors = useMemo(() => {
        if (!activeTextFile) {
            return [] as CompileErrorResult[];
        }
        if (dismissedErrorsFingerprint === errorsFingerprint) {
            return [] as CompileErrorResult[];
        }
        return (compileErrors ?? []).filter((error) => {
            if (!error.payload.latexFile) {
                return false;
            }
            const resolved =
                resolveProjectFileName(projectFiles, error.payload.latexFile) ??
                error.payload.latexFile;
            return projectFilePathsMatch(resolved, activeTextFile);
        });
    }, [
        activeTextFile,
        compileErrors,
        projectFiles,
        dismissedErrorsFingerprint,
        errorsFingerprint,
    ]);

    useEffect(() => {
        const body = bodyRef.current;
        if (!body || !activeTextFile) {
            return;
        }

        const syncHeight = () => {
            const nextHeight = body.clientHeight;
            if (nextHeight > 0) {
                setEditorHeight((prev) =>
                    prev === nextHeight ? prev : nextHeight
                );
            }
            refreshCodeMirrorLayout();
        };

        syncHeight();
        const observer = new ResizeObserver(syncHeight);
        observer.observe(body);

        return () => observer.disconnect();
    }, [activeTextFile]);

    useEffect(() => {
        if (saveTextFileRequestState === 'loading') {
            saveLoadingStartRef.current = performance.now();
            if (saveHideTimerRef.current) {
                clearTimeout(saveHideTimerRef.current);
                saveHideTimerRef.current = null;
            }
            queueMicrotask(() => setShowSaveLoading(true));
            return;
        }

        if (showSaveLoading) {
            const startedAt = saveLoadingStartRef.current ?? performance.now();
            const elapsed = performance.now() - startedAt;
            const remain = 500 - elapsed;
            if (remain > 0) {
                saveHideTimerRef.current = window.setTimeout(() => {
                    setShowSaveLoading(false);
                    saveHideTimerRef.current = null;
                }, remain);
            } else {
                queueMicrotask(() => setShowSaveLoading(false));
            }
        } else {
            queueMicrotask(() => setShowSaveLoading(false));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [saveTextFileRequestState]);

    useEffect(
        () => () => {
            if (saveHideTimerRef.current) {
                clearTimeout(saveHideTimerRef.current);
            }
        },
        []
    );

    useEffect(() => {
        const view = editorRef.current?.view;
        if (!view || loadTextFileRequestState === 'loading') {
            return;
        }
        applyErrorDecorations(view, fileTempErrors);
    }, [
        fileTempErrors,
        loadTextFileRequestState,
        textFileContent,
        editorViewEpoch,
    ]);

    useEffect(() => {
        const target = editorNavigationTarget;
        if (
            !target?.file ||
            !activeTextFile ||
            !projectFilePathsMatch(target.file, activeTextFile) ||
            loadTextFileRequestState === 'loading'
        ) {
            return;
        }

        let cancelled = false;
        let attempts = 0;
        const maxAttempts = 12;

        const tryApply = () => {
            if (cancelled) {
                return;
            }
            attempts += 1;
            if (scrollTextFileEditorLineIntoView(target.line)) {
                dispatch(setEditorNavigationTarget(null));
                return;
            }
            if (attempts < maxAttempts) {
                requestAnimationFrame(tryApply);
            } else {
                dispatch(setEditorNavigationTarget(null));
            }
        };

        requestAnimationFrame(tryApply);
        return () => {
            cancelled = true;
        };
    }, [
        editorNavigationTarget,
        activeTextFile,
        loadTextFileRequestState,
        textFileContent,
        dispatch,
    ]);

    const isLatexFile = activeTextFile
        ? isLatexTextFilePath(activeTextFile)
        : false;

    const languageExtension = useMemo(() => {
        if (!activeTextFile) {
            return [];
        }
        if (isLatexFile) {
            return [
                latex({
                    autoCloseTags: true,
                    enableAutocomplete: true,
                    enableLinting: false,
                    enableTooltips: true,
                    autoCloseBrackets: false,
                }),
            ];
        }
        return [];
    }, [activeTextFile, isLatexFile]);

    const cursorPersistenceListener = useMemo(
        () =>
            EditorView.updateListener.of((update) => {
                if (!update.selectionSet || !activeTextFile) {
                    return;
                }
                const from = update.state.selection.main.from;
                const line = update.state.doc.lineAt(from).number;
                dispatch(setActiveEditorLine(line));
                dispatch(
                    setSynctexEditorPosition({
                        segmentIndex: -1,
                        line,
                        file: activeTextFile,
                    })
                );
            }),
        [dispatch, activeTextFile]
    );

    const codeMirrorExtensions = useMemo(
        () => [
            ...languageExtension,
            EditorView.lineWrapping,
            ...(isLatexFile ? [] : [TEXT_FILE_PLAIN_TEXT_HIGHLIGHT]),
            TEXT_FILE_EDITOR_THEME,
            textFileEditorWheelScroll,
            decorationsField,
            cursorPersistenceListener,
        ],
        [isLatexFile, languageExtension, cursorPersistenceListener]
    );

    const onCreateEditor = useCallback((view: EditorView) => {
        syncCodeMirrorLayout(view);
        setEditorViewEpoch((epoch) => epoch + 1);
    }, []);

    const onChange = useCallback(
        (value: string) => {
            setDismissedErrorsFingerprint(errorsFingerprint);
            dispatch(
                controller.onTextFileContentChangedRequest({ content: value })
            );
        },
        [dispatch, errorsFingerprint]
    );

    const onClose = useCallback(() => {
        dispatch(controller.onTextFileEditorClosedRequest());
    }, [dispatch]);

    if (!activeTextFile) {
        return null;
    }

    const fileLabel = activeTextFile.includes('/')
        ? activeTextFile.slice(activeTextFile.lastIndexOf('/') + 1)
        : activeTextFile;
    const isLoading = loadTextFileRequestState === 'loading';

    return (
        <div className="ide-container text-file-editor-panel">
            <div className="ide-header">
                <div className="ide-wrapper">
                    <span
                        className="text-file-editor-title"
                        title={activeTextFile}
                    >
                        {fileLabel}
                    </span>
                </div>
                <div className="text-file-editor-header-actions">
                    {isAuth && !isReadonly ? (
                        <div
                            className="text-file-editor-save-status"
                            aria-label="save-status"
                        >
                            {showSaveLoading ? (
                                <span className="text-file-editor-save-spinner" />
                            ) : saveTextFileRequestState === 'error' ? (
                                <WarningIcon />
                            ) : (
                                <CheckIcon />
                            )}
                        </div>
                    ) : null}
                    <button
                        type="button"
                        className="text-file-editor-close"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <PlusIcon style={{ rotate: '45deg' }} />
                    </button>
                </div>
            </div>
            <div
                ref={bodyRef}
                className="ide-flexibility-container text-file-editor-body"
            >
                {isLoading ? (
                    <div className="ide-loading-wrapper" aria-hidden>
                        <span className="ide-loading-spinner" />
                    </div>
                ) : editorHeight > 0 ? (
                    <CodeMirror
                        ref={editorRef}
                        id={TEXT_FILE_EDITOR_HOST_ID}
                        value={textFileContent}
                        height={`${editorHeight}px`}
                        extensions={codeMirrorExtensions}
                        onChange={onChange}
                        onCreateEditor={onCreateEditor}
                        readOnly={isReadonly}
                        basicSetup={TEXT_FILE_EDITOR_BASIC_SETUP}
                    />
                ) : null}
            </div>
            <RunButton enableHotkey={false} />
        </div>
    );
};
