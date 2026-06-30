import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    PointerEvent as ReactPointerEvent,
} from 'react';
import classNames from 'classnames';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { langs } from '@uiw/codemirror-extensions-langs';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, StorageState } from '../../../../store';
import { controller } from '../../../../../main.tsx';
import { useIsProjectReadonly } from '../../../../store/selectors/program.ts';
import { PlusIcon } from '../../../../icons';
import {
    refreshCodeMirrorLayout,
    syncCodeMirrorLayout,
} from '../../../../utils/refreshCodeMirrorLayout';
import { textFileEditorWheelScroll } from './textFileEditorWheelScroll';
import './style.scss';

type TextFileEditorProps = {
    draggableHeader?: boolean;
    onHeaderPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onHeaderPointerMove?: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onHeaderPointerUp?: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

export const TextFileEditor = (props: TextFileEditorProps = {}) => {
    const dispatch = useDispatch<AppDispatch>();
    const activeTextFile = useSelector(
        (state: StorageState) => state.ide.activeTextFile
    );
    const textFileContent = useSelector(
        (state: StorageState) => state.ide.textFileContent
    );
    const isReadonly = useSelector(useIsProjectReadonly);
    const bodyRef = useRef<HTMLDivElement>(null);
    const [editorHeight, setEditorHeight] = useState(0);

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

    return (
        <div className="text-file-editor">
            <div
                className={classNames('text-file-editor-header', {
                    'text-file-editor-header-draggable': props.draggableHeader,
                })}
                onPointerDown={props.onHeaderPointerDown}
                onPointerMove={props.onHeaderPointerMove}
                onPointerUp={props.onHeaderPointerUp}
            >
                <span className="text-file-editor-title" title={activeTextFile}>
                    {fileLabel}
                </span>
                <button
                    type="button"
                    className="text-file-editor-close"
                    onClick={onClose}
                    aria-label="Close"
                >
                    <PlusIcon style={{ rotate: '45deg' }} />
                </button>
            </div>
            <div ref={bodyRef} className="text-file-editor-body">
                {editorHeight > 0 ? (
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
