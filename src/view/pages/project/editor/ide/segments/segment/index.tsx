/* eslint-disable react-hooks/exhaustive-deps */
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

import { CompileErrorResult, Segment } from '../../../../../../../model/domain';
import { customLanguageSupport } from './customLanguage';
import { latexLanguageSupport } from './latexLanguage';
import { notVisibleLanguageSupport } from './notVisibleLanguage';

import './style.scss';

import { Typography } from '../../../../../../components/typography';
import { DropdownMenu } from '../../../../../../components/dropdownMenu';
import { ArrowUp, PlusIcon } from '../../../../../../icons';
import { Checkbox } from '../../../../../../components/checkbox';
import {
    AppDispatch,
    StorageState,
} from '../../../../../../../viewModel/store';
import {
    useIsSegmentIsActive,
    useSearch,
} from '../../../../../../../viewModel/store/selectors/program';
import classNames from 'classnames';
import { colors } from '../../../../../../styles/colors';
import { useDictionary } from '../../../../../../../viewModel/store/selectors/translations';
import { SegmentDivider } from '../segment-divider';
import {
    deleteSegmentRequest,
    onAddedFilesToSegmentEditorRequest,
    onBlurSegmentRequest,
    onFocusSegmentRequest,
    onSegmentAddedViaDividerRequest,
    onSegmentTextChangedRequest,
    segmentEditorChangeSegmentPositionRequest,
    segmentEditorChangeSegmentVisibilityRequest,
} from '../../../../../../../controller';

const shortTypeMap = {
    computational: 'code',
    md: 'markdown',
    latex: 'latex',
    asciimath: 'formula',
};

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

export const SegmentEditor = memo(
    (props: { segment: Segment; index: number; segmentCount: number }) => {
        const editor = useRef<ReactCodeMirrorRef | undefined>();
        const dispatch = useDispatch<AppDispatch>();

        /*
        GLOBAL STATE
         */
        const search = useSelector(useSearch);
        const isActiveSegment = useSelector(useIsSegmentIsActive(props.index));
        const dictionary = useSelector(useDictionary);
        const compileErrors = useSelector(
            (state: StorageState) => state.project.compileErrorResult?.errors
        );
        const projectIsReadonly = useSelector(
            (state: StorageState) => state.project.projectIsReadonly
        );

        /*
        LOCAL STATE
         */
        // Переменная необходима, чтобы CodeMirror не сразу прогружался, иначе будет мигать
        const [isLoaded, setIsLoaded] = useState(false);
        // Промежуточный текст необходим по той же причине
        const [tempText, setTempText] = useState(props.segment.text);
        // Промежуточные ошибки нужны для того, чтобы при вводе текста их можно было скрывать
        const [segmentTempErrors, setTempSegmentErrors] = useState<
            CompileErrorResult[]
        >([]);

        /*
        Events
         */
        // При изменении глобального текста устанавливаем значение
        useEffect(() => {
            if (props.segment.text !== tempText) {
                setTempSegmentErrors([]);
                setTempText(props.segment.text);
            }
        }, [props.segment.text]);

        // При обновлении глобального списка ошибок фильтруем и устанавливаем локальный
        useEffect(() => {
            setTempSegmentErrors(
                (compileErrors ?? []).filter(
                    (e) => e.payload.segmentId === props.segment.id
                )
            );
        }, [compileErrors, props.segment.id]);

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

        /*
         * Callbacks
         */

        // Отдельный вызов для того, чтобы можно было таймер использовать
        // Таймер тоже тут нужен из-за CodeMirror
        const onBlur = useCallback(async () => {
            console.log('blur', props.index);
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
                focus: () =>
                    dispatch(
                        onFocusSegmentRequest({ segmentIndex: props.index })
                    ),
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
                        segmentId: props.segment.id,
                        editorCallback: (insert: string) => {
                            const cursorPosition =
                                editor?.current?.view?.state.selection.main
                                    .head; // Получаем позицию курсора
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
            [setTempText, setTempSegmentErrors]
        );

        // Первую прорисовку пропускаем
        if (!isLoaded) {
            return <div />;
        }

        return (
            <div>
                <div
                    className={classNames('segment-editor-container', {
                        'is-active': isActiveSegment,
                    })}
                >
                    <CodeMirror
                        ref={editor as LegacyRef<ReactCodeMirrorRef>}
                        value={tempText}
                        onChange={onChange}
                        readOnly={
                            projectIsReadonly ||
                            !props.segment.parameters.visible
                        }
                        extensions={[
                            decorationsField,
                            !props.segment.parameters.visible
                                ? notVisibleLanguageSupport
                                : props.segment.type === 'md'
                                  ? langs.markdown()
                                  : props.segment.type === 'computational'
                                    ? customLanguageSupport
                                    : props.segment.type === 'latex'
                                      ? [langs.stex(), latexLanguageSupport]
                                      : undefined,
                            eventsExt,
                            eventsDom,
                            EditorView.lineWrapping,
                            lineNumbers({
                                formatNumber: (lineNo) => {
                                    return `${props.segment.id || '' + 1}.${lineNo}`;
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
                                                        segmentIndex:
                                                            props.index,
                                                    }
                                                )
                                            )
                                        }
                                        className="change-position-button"
                                    >
                                        <ArrowUp />
                                    </div>
                                ) : null}
                                {props.index !== props.segmentCount - 1 ? (
                                    <div
                                        onClick={() =>
                                            dispatch(
                                                segmentEditorChangeSegmentPositionRequest(
                                                    {
                                                        direction: 'down',
                                                        segmentIndex:
                                                            props.index,
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
                                text={shortTypeMap[props.segment.type]}
                            />
                        </div>
                        <div className="segment-position">
                            <Typography
                                type={
                                    (props.segment.id ?? 0) < 10
                                        ? 'body'
                                        : 'label-small'
                                }
                                text={`${props.segment.id}`}
                                color={colors.white}
                            />
                        </div>
                        <DropdownMenu
                            clickable={!projectIsReadonly}
                            containerClassname="dropdown-content-contanier-additional"
                        >
                            <div
                                onClick={() =>
                                    dispatch(
                                        deleteSegmentRequest({
                                            segmentIndex: props.index,
                                        })
                                    )
                                }
                                className="delete-segment-container"
                            >
                                <div className="delete-icon">
                                    <PlusIcon />
                                </div>
                                <Typography
                                    color={colors.gray10}
                                    text={dictionary.delete}
                                />
                            </div>
                            <Checkbox
                                className="full-width-checkbox"
                                id={`visibility-segment-${props.index}`}
                                checked={!!props.segment.parameters.visible}
                                onChange={(v) =>
                                    dispatch(
                                        segmentEditorChangeSegmentVisibilityRequest(
                                            {
                                                segmentIndex: props.index,
                                                parameterName: 'visible',
                                                visible: v,
                                            }
                                        )
                                    )
                                }
                                title={dictionary.segment.visible}
                            />
                            <Checkbox
                                hidden={props.segment.type !== 'computational'}
                                className="full-width-checkbox"
                                id={`valued-assignment-${props.index}`}
                                checked={
                                    !!props.segment.parameters
                                        .hideAssignmentWithValues
                                }
                                onChange={(v) =>
                                    dispatch(
                                        segmentEditorChangeSegmentVisibilityRequest(
                                            {
                                                segmentIndex: props.index,
                                                parameterName:
                                                    'hideAssignmentWithValues',
                                                visible: v,
                                            }
                                        )
                                    )
                                }
                                title={
                                    dictionary.segment
                                        .hide_assignment_with_values
                                }
                            />
                            <Checkbox
                                hidden={props.segment.type !== 'computational'}
                                className="full-width-checkbox"
                                id={`array-${props.index}`}
                                checked={!!props.segment.parameters.hideArray}
                                onChange={(v) =>
                                    dispatch(
                                        segmentEditorChangeSegmentVisibilityRequest(
                                            {
                                                segmentIndex: props.index,
                                                parameterName: 'hideArray',
                                                visible: v,
                                            }
                                        )
                                    )
                                }
                                title={dictionary.segment.hide_array}
                            />
                            <Checkbox
                                hidden={props.segment.type !== 'computational'}
                                className="full-width-checkbox"
                                id={`general-${props.index}`}
                                checked={
                                    !!props.segment.parameters
                                        .hideGeneralFormula
                                }
                                onChange={(v) =>
                                    dispatch(
                                        segmentEditorChangeSegmentVisibilityRequest(
                                            {
                                                segmentIndex: props.index,
                                                parameterName:
                                                    'hideGeneralFormula',
                                                visible: v,
                                            }
                                        )
                                    )
                                }
                                title={dictionary.segment.hide_general_formula}
                            />
                            <Checkbox
                                hidden={props.segment.type !== 'computational'}
                                className="full-width-checkbox"
                                id={`infl-assig-${props.index}`}
                                checked={
                                    !!props.segment.parameters
                                        .hideInflAssignment
                                }
                                onChange={(v) =>
                                    dispatch(
                                        segmentEditorChangeSegmentVisibilityRequest(
                                            {
                                                segmentIndex: props.index,
                                                parameterName:
                                                    'hideInflAssignment',
                                                visible: v,
                                            }
                                        )
                                    )
                                }
                                title={dictionary.segment.hide_infl_assignment}
                            />
                            <Checkbox
                                hidden={props.segment.type !== 'computational'}
                                className="full-width-checkbox"
                                id={`infl-assig-${props.index}`}
                                checked={
                                    !!props.segment.parameters
                                        .hideInflAssignmentWithValues
                                }
                                onChange={(v) =>
                                    dispatch(
                                        segmentEditorChangeSegmentVisibilityRequest(
                                            {
                                                segmentIndex: props.index,
                                                parameterName:
                                                    'hideInflAssignmentWithValues',
                                                visible: v,
                                            }
                                        )
                                    )
                                }
                                title={
                                    dictionary.segment
                                        .hide_infl_assignment_with_values
                                }
                            />
                        </DropdownMenu>
                    </div>
                </div>
                <div style={{ flex: 1, marginTop: -10 }}>
                    {props.index + 1 !== props.segmentCount && (
                        <SegmentDivider
                            onAdd={(type) => {
                                dispatch(
                                    onSegmentAddedViaDividerRequest({
                                        segment: {
                                            id: -1,
                                            type: type,
                                            parameters: {
                                                visible: true,
                                            },
                                            text: '',
                                        },
                                        after: props.index,
                                    })
                                );
                            }}
                        />
                    )}
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
