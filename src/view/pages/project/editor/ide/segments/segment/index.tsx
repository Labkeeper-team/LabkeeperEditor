import CodeMirror, {
    Decoration,
    EditorView,
    ReactCodeMirrorRef,
    StateEffect,
    StateField,
    Range,
} from '@uiw/react-codemirror';
import { langs } from '@uiw/codemirror-extensions-langs';
import { content, dom } from '@uiw/codemirror-extensions-events';
import { lineNumbers } from '@codemirror/view';
import {
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
import { notVisibleLanguageSupport } from './notVisibleLanguage';

import './style.scss';

import { Typography } from '../../../../../../components/typography';
import { DropdownMenu } from '../../../../../../components/dropdownMenu';
import { ArrowUp } from '../../../../../../icons';
import {
    AppDispatch,
    StorageState,
} from '../../../../../../../viewModel/store';
import {
    useInputSegment,
    useInputSegmentsSize,
    useIsProjectReadonly,
    useIsSegmentIsActive,
    useSearch,
} from '../../../../../../../viewModel/store/selectors/program';
import classNames from 'classnames';
import { colors } from '../../../../../../styles/colors';
import {
    onAddedFilesToSegmentEditorRequest,
    onBlurSegmentRequest,
    onFocusSegmentRequest,
    onProgramSaveTimeoutRequest,
    onSegmentTextChangedRequest,
    segmentEditorChangeSegmentPositionRequest,
} from '../../../../../../../controller';
import { DropdownMenuContent } from './dropdownMenuContent';
import { useDictionary } from '../../../../../../../viewModel/store/selectors/translations.ts';

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

export const SegmentEditor = memo((props: { index: number }) => {
    const segment = useSelector(useInputSegment(props.index));
    const editor = useRef<ReactCodeMirrorRef | undefined>();
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);

    /*
        GLOBAL STATE
         */
    const search = useSelector(useSearch);
    const isActiveSegment = useSelector(useIsSegmentIsActive(props.index));
    const compileErrors = useSelector(
        (state: StorageState) => state.project.compileErrorResult?.errors
    );
    const projectIsReadonly = useSelector(useIsProjectReadonly);
    const segmentCount = useSelector(useInputSegmentsSize);

    /*
        LOCAL STATE
         */
    // Переменная необходима, чтобы CodeMirror не сразу прогружался, иначе будет мигать
    const [isLoaded, setIsLoaded] = useState(false);
    // Промежуточный текст необходим по той же причине
    const [tempText, setTempText] = useState(segment.text);
    // Промежуточные ошибки нужны для того, чтобы при вводе текста их можно было скрывать
    const [segmentTempErrors, setTempSegmentErrors] = useState<
        CompileErrorResult[]
    >([]);

    /*
        Events
         */
    // При изменении глобального текста устанавливаем значение
    useEffect(() => {
        if (segment.text !== tempText) {
            setTempSegmentErrors([]);
            setTempText(segment.text);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [segment.text]);

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
    // При изменении текста сегмента создаем таймер
    useEffect(() => {
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => {
            dispatch(onProgramSaveTimeoutRequest());
        }, 1000);
    }, [tempText]);

    /*
     * Callbacks
     */

    // Отдельный вызов для того, чтобы можно было таймер использовать
    // Таймер тоже тут нужен из-за CodeMirror
    const onBlur = useCallback(async () => {
        editor?.current?.editor?.blur?.();
        setTimeout(async () => {
            dispatch(
                onBlurSegmentRequest({
                    segmentText: tempText,
                    segmentIndex: props.index,
                })
            );
        });
    }, [props.index, dispatch, tempText]);

    // События редактора
    const eventsExt = useMemo(() => {
        return content({
            focus: () => {
                dispatch(onFocusSegmentRequest({ segmentIndex: props.index }));
            },
            blur: onBlur,
        });
    }, [dispatch, onBlur, props.index]);

    // Вставка файлов
    const eventsDom = dom({
        paste: async (ev: ClipboardEvent) => {
            const items = (ev?.clipboardData?.items ??
                []) as DataTransferItemList;
            dispatch(
                onAddedFilesToSegmentEditorRequest({
                    items: items,
                    segmentIndex: props.index,
                    editorCallback: (insert: string) => {
                        const cursorPosition =
                            editor?.current?.view?.state.selection.main.head; // Получаем позицию курсора
                        onChange(
                            `${tempText.slice(0, cursorPosition)}\n${insert}${tempText.slice(cursorPosition)}`
                        );
                    },
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
            setTempText(value);
            setTempSegmentErrors([]);
            setTimeout(() => {
                dispatch(
                    onSegmentTextChangedRequest({
                        segmentIndex: props.index,
                        segmentText: value,
                    })
                );
            });
        },
        [setTempText, setTempSegmentErrors, props.index, dispatch]
    );

    // Первую прорисовку пропускаем
    if (!isLoaded) {
        return <div />;
    }

    return (
        <div
            className={classNames('segment-editor-container', {
                'is-active': isActiveSegment,
            })}
        >
            <CodeMirror
                ref={editor as LegacyRef<ReactCodeMirrorRef>}
                value={tempText}
                onChange={onChange}
                readOnly={projectIsReadonly}
                extensions={[
                    decorationsField,
                    !segment.parameters.visible
                        ? notVisibleLanguageSupport
                        : segment.type === 'md'
                          ? langs.markdown()
                          : segment.type === 'computational'
                            ? customLanguageSupport
                            : segment.type === 'latex'
                              ? [langs.tex(), latexLanguageSupport]
                              : undefined,
                    eventsExt,
                    eventsDom,
                    EditorView.lineWrapping,
                    lineNumbers({
                        formatNumber: (lineNo) => {
                            return `${props.index + 1 || '' + 1}.${lineNo}`;
                        },
                    }),
                ].filter((e) => !!e)}
                basicSetup={{
                    lineNumbers: true,
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
                                        segmentEditorChangeSegmentPositionRequest(
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
                        {props.index !== segmentCount - 1 ? (
                            <div
                                onClick={() =>
                                    dispatch(
                                        segmentEditorChangeSegmentPositionRequest(
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
                        type={(props.index ?? 0) < 10 ? 'body' : 'label-small'}
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
});

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
