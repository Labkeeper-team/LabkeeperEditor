import CodeMirror, {
    Decoration,
    EditorView,
    ReactCodeMirrorRef,
    StateEffect,
    StateField,
    Range,
} from '@uiw/react-codemirror';
import { EditorSelection, type Extension } from '@codemirror/state';
import { langs } from '@uiw/codemirror-extensions-langs';
import { content, dom } from '@uiw/codemirror-extensions-events';
import { lineNumbers, type ViewUpdate } from '@codemirror/view';
import {
    createRef,
    LegacyRef,
    memo,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { CompileErrorResult } from '../../../../../../../model/domain';
import { customLanguageSupport } from './customLanguage';
import { latexLanguageSupport } from './latexLanguage';
import { getMarkdownSpellcheckLint } from './segmentSpellcheck';

import './style.scss';

import { Typography } from '../../../../../../components/typography';
import { DropdownMenu } from '../../../../../../components/dropdownMenu';
import { ArrowUp } from '../../../../../../icons';
import { AppDispatch, StorageState } from '../../../../../../store';
import { setPendingSegmentEditorCursor } from '../../../../../../store/slices/ide';
import {
    useIsProjectReadonly,
    useSearch,
} from '../../../../../../store/selectors/program';
import classNames from 'classnames';
import { colors } from '../../../../../../styles/colors';
import { DropdownMenuContent } from './dropdownMenuContent';
import { useDictionary } from '../../../../../../store/selectors/translations.ts';
import { controller } from '../../../../../../../main.tsx';
import { LRUMap } from 'lru_map';
import { useScrollableToActive } from '../../../../../../hooks/useScrollableToActive.ts';
import { useIsDelayedSegmentIsActive } from '../../../../../../hooks/useIsDelayedSegmentIsActive.ts';

const CURSOR_MAP_CAPACITY = 100;

/** Стабильная ссылка: иначе @uiw/react-codemirror на каждом рендере делает StateEffect.reconfigure и мигает подсветка. */
const SEGMENT_CODE_MIRROR_BASIC_SETUP = {
    lineNumbers: true,
    highlightSelectionMatches: false,
    /** Текст и undo ведёт ProgramService (кнопка и Ctrl+Z в шапке). Встроенная history CM + historyKeymap дают второй Ctrl+Z и откатывают лишние правки. */
    history: false,
    historyKeymap: false,
} as const;

const SEGMENT_CM_SPELLCHECK = EditorView.contentAttributes.of({
    spellcheck: 'true',
});

/** Для md Hunspell через @codemirror/lint; нативный spellcheck отключаем, чтобы не дублировать подчёркивания. */
const SEGMENT_CM_SPELLCHECK_OFF = EditorView.contentAttributes.of({
    spellcheck: 'false',
});

const setDecorationsEffect = StateEffect.define();

const decorationsField = StateField.define<unknown>({
    create() {
        return Decoration.none;
    },
    update(decorations, transaction) {
        // Обновляем декорации, если есть эффект setDecorationsEffect
        for (const effect of transaction.effects) {
            if (effect.is(setDecorationsEffect)) {
                return effect.value;
            }
        }
        return decorations;
    },
    provide: (field) => EditorView.decorations.from(field),
});

let timeout: NodeJS.Timeout | null = null;

const lastDecorationSignatureByView = new WeakMap<EditorView, string>();

function computeDocKey(text: string): string {
    let hash = 5381;
    for (let i = 0; i < text.length; i++) {
        // djb2 с XOR, быстрый и достаточно устойчивый для ключа
        hash = (hash * 33) ^ text.charCodeAt(i);
    }
    return `${text.length}:${hash >>> 0}`;
}

export const SegmentEditor = memo(
    (props: { index: number; isLast: boolean }) => {
        const segment = useSelector(
            (state: StorageState) =>
                state.project.currentProgram?.segments[props.index]
        );
        const ref = createRef<HTMLDivElement>();
        const editor = useRef<ReactCodeMirrorRef | undefined>();
        const lastCursorPosRef = useRef<number | null>(null);
        const cursorByDocKeyRef = useRef<LRUMap<string, number>>(
            new LRUMap(CURSOR_MAP_CAPACITY)
        );
        const currentDocKeyRef = useRef<string | null>(null);
        const dispatch = useDispatch<AppDispatch>();
        const dictionary = useSelector(useDictionary);

        /*
        GLOBAL STATE
         */
        const search = useSelector(useSearch);
        const [debouncedSearch, setDebouncedSearch] = useState(search);
        const isActiveSegment = useIsDelayedSegmentIsActive(props.index);
        /** Без задержки 10 ms: иначе после undo/redo в другой сегмент считается «неактивным» и ломается фокус. */
        const isImmediatelyActiveSegment = useSelector(
            (state: StorageState) =>
                state.ide.activeSegmentIndex === props.index
        );
        const pendingSegmentEditorCursor = useSelector(
            (state: StorageState) => state.ide.pendingSegmentEditorCursor
        );
        const pendingIdeCursorRef = useRef(pendingSegmentEditorCursor);
        pendingIdeCursorRef.current = pendingSegmentEditorCursor;
        const segmentTextForPendingRef = useRef(segment?.text);
        segmentTextForPendingRef.current = segment?.text;
        const segmentIdxForPendingRef = useRef(props.index);
        segmentIdxForPendingRef.current = props.index;
        const dispatchForPendingRef = useRef(dispatch);
        dispatchForPendingRef.current = dispatch;
        const compileErrors = useSelector(
            (state: StorageState) => state.project.compileErrorResult?.errors
        );
        const projectIsReadonly = useSelector(useIsProjectReadonly);

        /*
        LOCAL STATE
         */
        // Переменная необходима, чтобы CodeMirror не сразу прогружался, иначе будет мигать
        const [isLoaded, setIsLoaded] = useState(false);
        // Промежуточные ошибки нужны для того, чтобы при вводе текста их можно было скрывать
        const [segmentTempErrors, setTempSegmentErrors] = useState<
            CompileErrorResult[]
        >([]);

        /*
        Events
         */
        // При обновлении глобального списка ошибок фильтруем и устанавливаем локальный
        useEffect(() => {
            setTempSegmentErrors(
                (compileErrors ?? []).filter(
                    (e) => e.payload.segmentId === props.index + 1
                )
            );
        }, [compileErrors, props.index]);

        // Проблема с мерцанием редактора кода
        useEffect(() => {
            const timer = setTimeout(() => {
                setIsLoaded(true);
            });
            return () => clearTimeout(timer);
        }, []);

        useEffect(() => {
            const handle = window.setTimeout(() => {
                setDebouncedSearch(search);
            }, 150);
            return () => clearTimeout(handle);
        }, [search]);

        // Ошибки компиляции — сразу (в deps); строка поиска — через debouncedSearch
        useEffect(() => {
            const view = editor?.current?.view;
            if (!view) {
                return;
            }
            processDecorations(view, debouncedSearch, segmentTempErrors);
        }, [debouncedSearch, segmentTempErrors, editor?.current?.view]);
        // Фиксируем горизонтальный скролл на 0, чтобы сегмент не смещался при выделении
        useEffect(() => {
            const view = editor?.current?.view;
            if (!view) {
                return;
            }
            const scroller = view.scrollDOM;
            const lockHorizontalScroll = () => {
                if (scroller.scrollLeft !== 0) {
                    scroller.scrollLeft = 0;
                }
            };
            scroller.addEventListener('scroll', lockHorizontalScroll, {
                passive: true,
            });
            return () => {
                scroller.removeEventListener('scroll', lockHorizontalScroll);
            };
        }, [editor?.current?.view]);

        // Дополнительно удерживаем scrollLeft=0 во время drag-выделения мышью
        useEffect(() => {
            const view = editor?.current?.view;
            if (!view) {
                return;
            }
            const scroller = view.scrollDOM;
            let rafId: number | null = null;
            const enforce = () => {
                if (scroller.scrollLeft !== 0) {
                    scroller.scrollLeft = 0;
                }
                rafId = requestAnimationFrame(enforce);
            };
            const onMouseDown = (e: MouseEvent) => {
                if (e.buttons & 1) {
                    if (rafId == null) {
                        enforce();
                    }
                }
            };
            const onMouseUp = () => {
                if (rafId != null) {
                    cancelAnimationFrame(rafId);
                    rafId = null;
                }
            };
            scroller.addEventListener('mousedown', onMouseDown);
            window.addEventListener('mouseup', onMouseUp);
            return () => {
                if (rafId != null) {
                    cancelAnimationFrame(rafId);
                }
                scroller.removeEventListener('mousedown', onMouseDown);
                window.removeEventListener('mouseup', onMouseUp);
            };
        }, [editor?.current?.view]);
        // Если сегмент перестал быть активным — снимаем выделение в редакторе
        useEffect(() => {
            if (isActiveSegment || isImmediatelyActiveSegment) {
                return;
            }
            const view = editor?.current?.view;
            if (!view) {
                return;
            }
            const head = view.state.selection.main.head;
            view.dispatch({
                selection: EditorSelection.cursor(head),
            });
        }, [isActiveSegment, isImmediatelyActiveSegment]);
        // При изменении текста сегмента создаем таймер
        useEffect(() => {
            if (timeout) {
                clearTimeout(timeout);
            }
            timeout = setTimeout(() => {
                dispatch(controller.onProgramSaveTimeoutRequest());
            }, 1000);
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [segment?.text]);

        // Восстанавливаем курсор только если текст пришёл извне (не совпадает с документом CM)
        useEffect(() => {
            const view = editor?.current?.view;
            if (!view) {
                return;
            }
            const docText = view.state.doc.toString();
            if (docText === segment?.text) {
                return;
            }
            const docKey = currentDocKeyRef.current ?? computeDocKey(docText);
            const storedForDoc = cursorByDocKeyRef.current.get(docKey);
            const preserved =
                typeof storedForDoc === 'number'
                    ? storedForDoc
                    : typeof lastCursorPosRef.current === 'number'
                      ? lastCursorPosRef.current
                      : view.state.selection.main.head;
            const docLength = view.state.doc.length;
            const clamped = Math.max(0, Math.min(preserved, docLength));
            view.dispatch({
                selection: EditorSelection.cursor(clamped),
            });
        }, [segment?.text]);

        useScrollableToActive(ref, 'segments-container', props.index);

        /*
         * Callbacks
         */

        // Отдельный вызов для того, чтобы можно было таймер использовать
        // Таймер тоже тут нужен из-за CodeMirror
        const onBlur = useCallback(async () => {
            editor?.current?.editor?.blur?.();
            dispatch(
                controller.onBlurSegmentRequest({
                    segmentIndex: props.index,
                })
            );
        }, [props.index, dispatch]);

        // События редактора
        const eventsExt = useMemo(() => {
            return content({
                focus: () => {
                    if (isActiveSegment) {
                        return;
                    }
                    dispatch(
                        controller.onFocusSegmentRequest({
                            segmentIndex: props.index,
                        })
                    );
                },
                blur: onBlur,
            });
        }, [dispatch, onBlur, props.index, isActiveSegment]);

        // Вставка файлов — extension должна быть стабильной ссылкой, иначе extensions[] пересобирается на каждый символ → reconfigure → мигание syntax highlight
        const eventsDom = useMemo(
            () =>
                dom({
                    paste: async (ev: ClipboardEvent | KeyboardEvent) => {
                        if (!('clipboardData' in ev)) {
                            return;
                        }
                        const items = (ev.clipboardData?.items ??
                            []) as DataTransferItemList;
                        dispatch(
                            controller.onAddedFilesToSegmentEditorRequest({
                                items: items,
                                segmentIndex: props.index,
                                cursorPosition:
                                    editor?.current?.view?.state.selection.main
                                        .head ?? 0,
                            })
                        );
                        ev.preventDefault();
                    },
                }),
            [dispatch, props.index]
        );

        /** Курсор после undo/redo: сразу в той же транзакции, что и подстановка value (без rAF — надёжно на длинных документах). */
        const pendingUndoRedoCursorListener = useMemo(
            () =>
                EditorView.updateListener.of((update) => {
                    if (!update.docChanged) {
                        return;
                    }
                    const pending = pendingIdeCursorRef.current;
                    if (
                        !pending ||
                        pending.segmentIndex !== segmentIdxForPendingRef.current
                    ) {
                        return;
                    }
                    const expected = segmentTextForPendingRef.current ?? '';
                    const doc = update.state.doc;
                    if (doc.length !== expected.length) {
                        return;
                    }
                    if (doc.toString() !== expected) {
                        return;
                    }
                    const clamped = Math.max(
                        0,
                        Math.min(pending.offset, doc.length)
                    );
                    update.view.dispatch({
                        selection: EditorSelection.cursor(clamped),
                    });
                    update.view.dom.scrollIntoView({
                        block: 'nearest',
                        inline: 'nearest',
                        behavior: 'auto',
                    });
                    update.view.focus();
                    queueMicrotask(() => {
                        dispatchForPendingRef.current(
                            setPendingSegmentEditorCursor(null)
                        );
                    });
                }),
            []
        );

        const cursorPersistenceListener = useMemo(
            () =>
                EditorView.updateListener.of((update) => {
                    if (update.docChanged) {
                        const text = update.state.doc.toString();
                        currentDocKeyRef.current = computeDocKey(text);
                    }
                    if (update.selectionSet) {
                        const head = update.state.selection.main.head;
                        lastCursorPosRef.current = head;
                        const key =
                            currentDocKeyRef.current ??
                            computeDocKey(update.state.doc.toString());
                        cursorByDocKeyRef.current.set(key, head);
                    }
                }),
            []
        );

        const languageExtension = useMemo(() => {
            const t = segment?.type;
            if (t === 'md') {
                return langs.markdown();
            }
            if (t === 'computational') {
                return customLanguageSupport;
            }
            if (t === 'latex') {
                return [langs.tex(), latexLanguageSupport];
            }
            return undefined;
        }, [segment?.type]);

        const lineNumbersExtension = useMemo(
            () =>
                lineNumbers({
                    formatNumber: (lineNo) => `${props.index + 1}.${lineNo}`,
                }),
            [props.index]
        );

        const contentAttrsExtension = useMemo(
            () =>
                segment?.type === 'md'
                    ? SEGMENT_CM_SPELLCHECK_OFF
                    : SEGMENT_CM_SPELLCHECK,
            [segment?.type]
        );

        const markdownSpellLint = useMemo(
            () => (segment?.type === 'md' ? getMarkdownSpellcheckLint() : null),
            [segment?.type]
        );

        /** Новый массив на каждом рендере → useCodeMirror делает reconfigure → мигает gutter. */
        const codeMirrorExtensions = useMemo((): Extension[] => {
            return [
                contentAttrsExtension,
                decorationsField,
                languageExtension,
                eventsExt,
                eventsDom,
                pendingUndoRedoCursorListener,
                cursorPersistenceListener,
                EditorView.lineWrapping,
                lineNumbersExtension,
                markdownSpellLint,
            ].filter((e): e is Extension => e != null);
        }, [
            contentAttrsExtension,
            languageExtension,
            eventsExt,
            eventsDom,
            pendingUndoRedoCursorListener,
            cursorPersistenceListener,
            lineNumbersExtension,
            markdownSpellLint,
        ]);

        // Вызов, который меняет текст и сбрасывает ошибки и декорации.
        // Нельзя откладывать dispatch (setTimeout): при зажатой клавише в очередь попадают
        // несколько задач со старым segmentText — Redux отстаёт от CodeMirror, useCodeMirror
        // подставляет устаревший value и перезаписывает документ → курсор уезжает (часто в 0).
        const onChange = useCallback(
            (value: string, update: ViewUpdate) => {
                editor?.current?.view?.dispatch({
                    effects: setDecorationsEffect.of(Decoration.none as never),
                });
                setTempSegmentErrors([]);
                const cursorHead = update.state.selection.main.head;
                dispatch(
                    controller.onSegmentTextChangedRequest({
                        segmentIndex: props.index,
                        segmentText: value,
                        cursorHead,
                    })
                );
            },
            [props.index, dispatch]
        );

        // Первую прорисовку пропускаем
        if (!isLoaded) {
            return <div />;
        }

        return (
            <div
                ref={ref}
                className={classNames('segment-editor-container', {
                    'is-active': isActiveSegment,
                    'not-visible': !segment.parameters.visible,
                })}
            >
                <CodeMirror
                    ref={editor as LegacyRef<ReactCodeMirrorRef>}
                    id={`ide-segment-${props.index}`}
                    value={segment?.text}
                    onChange={onChange}
                    readOnly={projectIsReadonly}
                    extensions={codeMirrorExtensions}
                    basicSetup={SEGMENT_CODE_MIRROR_BASIC_SETUP}
                />
                <div className="editor-rules">
                    {!projectIsReadonly && (
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'row',
                                gap: 2,
                                alignItems: 'center',
                            }}
                        >
                            {props.index ? (
                                <div
                                    onClick={() =>
                                        dispatch(
                                            controller.segmentEditorChangeSegmentPositionRequest(
                                                {
                                                    direction: 'up',
                                                    segmentIndex: props.index,
                                                }
                                            )
                                        )
                                    }
                                    className="change-position-button"
                                >
                                    <ArrowUp />
                                </div>
                            ) : null}
                            {!props.isLast ? (
                                <div
                                    onClick={() =>
                                        dispatch(
                                            controller.segmentEditorChangeSegmentPositionRequest(
                                                {
                                                    direction: 'down',
                                                    segmentIndex: props.index,
                                                }
                                            )
                                        )
                                    }
                                    className="change-position-button rotate"
                                >
                                    <ArrowUp />
                                </div>
                            ) : null}
                        </div>
                    )}
                    <div className="segment-type-container">
                        <Typography
                            color={colors.gray10}
                            text={dictionary.short_segment[segment.type]}
                        />
                    </div>
                    <div className="segment-position">
                        <Typography
                            type={
                                (props.index ?? 0) < 10 ? 'body' : 'label-small'
                            }
                            text={`${props.index + 1}`}
                            color={colors.white}
                        />
                    </div>
                    <DropdownMenu
                        clickable={!projectIsReadonly}
                        containerClassname="dropdown-content-contanier-additional"
                    >
                        <DropdownMenuContent
                            index={props.index}
                            segment={segment}
                        />
                    </DropdownMenu>
                </div>
            </div>
        );
    }
);

function processDecorations(
    view: EditorView,
    search: string | undefined,
    segmentTempErrors: CompileErrorResult[]
) {
    const docText = view.state.doc.toString(); // Получаем текст документа

    const decorations: Range<Decoration>[] = [];
    if (typeof search === 'string') {
        let startIndex = docText.indexOf(search);
        if (search) {
            // Ищем все вхождения текста
            while (startIndex !== -1) {
                const endIndex = startIndex + search.length;
                decorations.push(
                    Decoration.mark({
                        class: 'highlight-text-editor',
                    }).range(startIndex, endIndex)
                );
                startIndex = docText.indexOf(search, endIndex); // Ищем следующее вхождение
            }
        }
    }
    if (segmentTempErrors.length) {
        const docTextSpliitedByNewLine = docText.split('\n');
        const sortedErrors = [...segmentTempErrors].sort(
            (a, b) => a.payload.line - b.payload.line
        );
        sortedErrors.forEach((segmentError) => {
            const lineNumber = segmentError.payload.line;
            const row = docTextSpliitedByNewLine[segmentError.payload.line];
            const startIndex = docTextSpliitedByNewLine
                .slice(0, lineNumber)
                .reduce((total, cur) => total + cur.length + 1, 0);

            const endIndex = startIndex + (row?.length || 1);

            decorations.push(
                Decoration.mark({
                    class: 'highlight-text-editor-error',
                }).range(startIndex, endIndex)
            );
        });
    }

    const isChunkValid = (chunk) => {
        const textLength = docText.length;
        return (
            textLength &&
            chunk.from >= 0 &&
            chunk.to <= textLength &&
            chunk.from <= textLength &&
            chunk.from < chunk.to
        );
    };

    const validChunks = decorations.filter(isChunkValid);
    validChunks.sort((a, b) => a.from - b.from);
    const isVAlidChunkExistAndTextExist =
        validChunks.length && docText.length > 0;
    const decSet = Decoration.set(
        isVAlidChunkExistAndTextExist ? validChunks : []
    );
    const signature = JSON.stringify({
        h: computeDocKey(docText),
        s: typeof search === 'string' ? search : '',
        e: segmentTempErrors.map((x) => x.payload.line).join(','),
        n: validChunks.length,
    });
    if (lastDecorationSignatureByView.get(view) === signature) {
        return;
    }
    lastDecorationSignatureByView.set(view, signature);
    if (!view.dom?.isConnected) {
        return;
    }
    try {
        view.dispatch({
            effects: setDecorationsEffect.of(decSet as never),
        });
    } catch {
        /* view уже размонтирован между debounce и dispatch */
    }
}
