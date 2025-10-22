import CodeMirror, {
    Decoration,
    EditorView,
    ReactCodeMirrorRef,
    StateEffect,
    StateField,
    Range,
} from '@uiw/react-codemirror';
import { EditorSelection } from '@codemirror/state';
import { langs } from '@uiw/codemirror-extensions-langs';
import { content, dom } from '@uiw/codemirror-extensions-events';
import { lineNumbers } from '@codemirror/view';
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

import './style.scss';

import { Typography } from '../../../../../../components/typography';
import { DropdownMenu } from '../../../../../../components/dropdownMenu';
import { ArrowUp } from '../../../../../../icons';
import { AppDispatch, StorageState } from '../../../../../../store';
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
        const isActiveSegment = useIsDelayedSegmentIsActive(props.index);
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
        useEffect(() => {
            if (!isActiveSegment) {
                return;
            }
            const view = editor?.current?.view;
            view?.dispatch({
                selection: EditorSelection.cursor(0),
            });
            view?.focus();
        }, [isActiveSegment]);
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

        // При изменении текста перерисовываем декорации
        useEffect(() => {
            const view = editor?.current?.view;
            if (!view) {
                return;
            }
            processDecorations(view, search, segmentTempErrors);
        }, [search, segmentTempErrors, editor?.current?.view]);
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
            if (isActiveSegment) {
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
        }, [isActiveSegment]);
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

        // Восстанавливаем позицию курсора после внешнего обновления текста сегмента
        useEffect(() => {
            const view = editor?.current?.view;
            if (!view) {
                return;
            }
            const docText = view.state.doc.toString();
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
                    console.log(1123);
                    dispatch(
                        controller.onFocusSegmentRequest({
                            segmentIndex: props.index,
                        })
                    );
                },
                blur: onBlur,
            });
        }, [dispatch, onBlur, props.index]);

        // Вставка файлов и обработка клавиш
        const eventsDom = dom({
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
                            editor?.current?.view?.state.selection.main.head ??
                            0,
                    })
                );
                ev.preventDefault();
            },
        });

        // Вызов, который меняет текст и сбрасывает ошибки и декорации
        const onChange = useCallback(
            async (value) => {
                editor?.current?.view?.dispatch({
                    effects: setDecorationsEffect.of(Decoration.none as never),
                });
                setTempSegmentErrors([]);
                setTimeout(() => {
                    dispatch(
                        controller.onSegmentTextChangedRequest({
                            segmentIndex: props.index,
                            segmentText: value,
                        })
                    );
                });
            },
            [setTempSegmentErrors, props.index, dispatch]
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
                    value={segment?.text}
                    onChange={onChange}
                    readOnly={projectIsReadonly}
                    extensions={[
                        decorationsField,
                        segment.type === 'md'
                            ? langs.markdown()
                            : segment.type === 'computational'
                              ? customLanguageSupport
                              : segment.type === 'latex'
                                ? [langs.tex(), latexLanguageSupport]
                                : undefined,
                        eventsExt,
                        eventsDom,
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
                        EditorView.lineWrapping,
                        lineNumbers({
                            formatNumber: (lineNo) => {
                                return `${props.index + 1 || '' + 1}.${lineNo}`;
                            },
                        }),
                    ].filter((e) => !!e)}
                    basicSetup={{
                        lineNumbers: true,
                        history: false,
                    }}
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
    view.dispatch({
        effects: setDecorationsEffect.of(decSet as never),
    });
}
