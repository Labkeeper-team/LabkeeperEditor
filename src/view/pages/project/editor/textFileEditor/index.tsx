import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { langs } from '@uiw/codemirror-extensions-langs';
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
import '../ide/style.scss';
import '../ide/header/style.scss';
import './style.scss';

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
    const isReadonly = useSelector(useIsProjectReadonly);
    const isAuth = useSelector(
        (state: StorageState) => state.user.isAuthenticated
    );
    const bodyRef = useRef<HTMLDivElement>(null);
    const [editorHeight, setEditorHeight] = useState(0);
    const [showSaveLoading, setShowSaveLoading] = useState(false);
    const saveLoadingStartRef = useRef<number | null>(null);
    const saveHideTimerRef = useRef<number | null>(null);

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
            const startedAt =
                saveLoadingStartRef.current ?? performance.now();
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

    const languageExtension = useMemo(() => {
        if (!activeTextFile) {
            return [];
        }
        if (activeTextFile.toLowerCase().endsWith('.tex')) {
            return langs.tex();
        }
        return langs.text();
    }, [activeTextFile]);

    const codeMirrorExtensions = useMemo(
        () => [languageExtension, textFileEditorWheelScroll],
        [languageExtension]
    );

    const onCreateEditor = useCallback((view: EditorView) => {
        syncCodeMirrorLayout(view);
    }, []);

    const onChange = useCallback(
        (value: string) => {
            dispatch(
                controller.onTextFileContentChangedRequest({ content: value })
            );
        },
        [dispatch]
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
                        value={textFileContent}
                        height={`${editorHeight}px`}
                        extensions={codeMirrorExtensions}
                        onChange={onChange}
                        onCreateEditor={onCreateEditor}
                        readOnly={isReadonly}
                        basicSetup={{
                            lineNumbers: true,
                            foldGutter: false,
                        }}
                    />
                ) : null}
            </div>
        </div>
    );
};
