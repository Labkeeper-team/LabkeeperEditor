import CodeMirror, {Decoration, EditorView, ReactCodeMirrorRef, StateEffect, StateField} from "@uiw/react-codemirror";
import { langs } from '@uiw/codemirror-extensions-langs';
import {content, dom} from '@uiw/codemirror-extensions-events';
import { lineNumbers } from '@codemirror/view';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { debounce } from 'throttle-debounce';

import {CompileErrorResult, Program, Segment} from '../../../../../../shared/models/project';
import { customLanguageSupport } from './customLanguage';

import './style.scss';

import {
  addSegmentAfter,
  changeSegmentPosition,
  changeSegmentText,
  deleteSegment,
  setSegmentVisibility,
} from '../../../../../../store/slices/project';
import { Typography } from '../../../../../../componenets/typography';
import { DropdownMenu } from '../../../../../../shared/components/dropdownMenu';
import { ArrowUp, PlusIcon } from '../../../../../../shared/icons';
import { Checkbox } from '../../../../../../componenets/checkbox';
import { StorageState, store } from '../../../../../../store';
import {
  useCurrentProjectId,
  useIsAutocompilationEnabeled,
  useIsHightlight,
  useIsSegmentIsActive,
  useSearch,
} from '../../../../../../store/selectors/program';
import classNames from 'classnames';
import { setActiveSegmentIndex, setUpdateFiles } from '../../../../../../store/slices/ide';
import { colors } from '../../../../../../shared/styles/colors';
import { useDictionary } from "../../../../../../store/selectors/translations";
import { toast } from "react-toastify";
import {uploadFileRequest} from "../../../../../../rpi/files.tsx";
import {saveProgramRequest} from "../../../../../../rpi/project.tsx";
import {logoutAction} from "../../../../../../store/actions";
import { compileProject } from "../../../../../../store/thunk";
import { checkFile } from "../../../../../../utils/file";
import {SegmentDivider} from "../segment-divider";


const shortTypeMap = {
  computational: 'code',
  md: 'markdown',
};

const setDecorationsEffect = StateEffect.define();

const decorationsField = StateField.define<any>({
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

export const SegmentEditor = memo((props: { segment: Segment; index: number, segmentCount: number }) => {
  const editor = useRef<ReactCodeMirrorRef | undefined>();
  const dispatch = useDispatch();
  const [isLoaded, setIsLoaded] = useState(false);

  const dictionary = useSelector(useDictionary);
  const compileErrors = useSelector((state: StorageState) => state.project.compileErrorResult?.errors)
  const projectIsReadonly = useSelector((state: StorageState) => state.project.projectIsReadonly)
  const segmentErrors = useMemo(() => {
    return (compileErrors ?? []).filter(e => e.payload.segmentId === props.segment.id);
  }, [compileErrors,  props.segment.id]);

  const [segmentTempErrors, setTempSegmentErrors] = useState<CompileErrorResult[]>([]);
  const search = useSelector(useSearch);
  const projectId = useSelector(useCurrentProjectId);
  const isActiveSegment = useSelector(useIsSegmentIsActive(props.segment.id!));
  const isAutocompete = useSelector(useIsAutocompilationEnabeled);
  const isHightlight = useSelector(useIsHightlight);

  const [tempText, setTempText] = useState(props.segment.text);

  useEffect(() => {
    if (props.segment.text !== tempText) {
      setTempSegmentErrors([]);
      setTempText(props.segment.text);
    }
  }, [props.segment.text])
  
  useEffect(() => {
    console.log(segmentErrors, props.segment.id);
    setTempSegmentErrors(segmentErrors);
  }, [segmentErrors])

  // Проблема с мерцанием редактора кода
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    });
    return () => clearTimeout(timer);
  }, []);

  const debounceCompile = useCallback(
    debounce(
      4000,
      async (value, projectId) => {
        const segmentText = value
        const index = props.index

        const program = store.getState().project.history.at(-1);
        if (!program) {
          return;
        }
        const tmpProgram: Program = JSON.parse(JSON.stringify(program));
        tmpProgram.segments = tmpProgram.segments.map((item, index_) => {
          if (index_ === index) {
            item.text = segmentText;
            return item;
          }
          return item;
        });
        const result = await saveProgramRequest(projectId.toString(), tmpProgram)
        if (result.code === 401 || result.code === 403) {
          store.dispatch(logoutAction)
          toast(dictionary.filemanager.errors.sessionExpired, {type: 'error'});
        }
        if (result.isOk) {
          store.dispatch(compileProject());
        }
      },
      { atBegin: false }
    ),
    [props.index]
  );

  const saveProgramDirectly = useCallback(async () => {
    if (!isAutocompete) {
    //   return;
    }
    const savedProgram = store.getState().project.history.at(-1);
    if (!savedProgram) {
      return;
    }
    if (projectId && !isNaN(+projectId)) {
      await saveProgramRequest(projectId.toString(), savedProgram)
    }
  }, [isAutocompete, projectId]);

  const onChangePosition = async (direction: 'up' | 'down') => {
    dispatch(changeSegmentPosition({currentPosition: props.index, direction}));
    await saveProgramDirectly()
  }

  const onChangeVisible = (newValue: boolean, name: string) => {
    dispatch(setSegmentVisibility({ index: props.index, visible: newValue, name: name }));
  };

  const onDeleteSegment = async () => {
    dispatch(deleteSegment(props.index));
    await saveProgramDirectly()
    if (!isAutocompete) {
      return;
    }
    if (!projectId) {
      return;
    }
    store.dispatch(compileProject());
  };

  const onBlur = useCallback(
    async () => {
      dispatch(setActiveSegmentIndex(-1));
      // TODO - Костыль. даже в репо у либы нерешенная проблема
      setTimeout(async () => {
        dispatch(changeSegmentText({ text: tempText, index: props.index }));
        saveProgramDirectly();
      })

    },
    [props.index, dispatch, tempText, saveProgramDirectly]
  );

  const onFocusMemo= useCallback(() => {
    dispatch(setActiveSegmentIndex(props.segment.id!));
  }, [props.segment.id, dispatch])

  const eventsExt = useMemo(() => {
    return content({
      focus: onFocusMemo,
      blur: onBlur,
    })
  }, [onBlur, onFocusMemo]) 

  const eventsDom = dom({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    paste: async (ev: any) => {
      const items = ev?.clipboardData?.items ?? [];
      for (const item of items) {
        await new Promise((reslv) =>  {
          try {
            if (item.kind === "file") {
              if (!projectId) {
                toast(dictionary.segment.errors.non_authorized_paste_image, {type: 'error'})
                return reslv(null);
              }
              const file = item.getAsFile();
              if (!file) {
                return reslv(null);
              }
              checkFile(file, dictionary);
              const reader = new FileReader();
              reader.onload = async function () {
                  const fileToUpload = file;
                  const [, ext] = file.name.split('.');
                  const name = `${props.segment.id}-${Date.now()}.${ext}`
                  const formData = new FormData();
                  const filename = name ?? 'Файлнейм';
                  formData.append('file', fileToUpload);

                  const res = await uploadFileRequest(formData, projectId?.toString(), name);

                  if (res.code === 409) {
                    toast( dictionary.filemanager.errors.tooMuchFiles , {type: 'error'});
                    reslv(null)
                  }
                  if (res.isUnauth) {
                    toast(dictionary.filemanager.errors.sessionExpired, {type: 'error'});
                    dispatch(logoutAction)
                    reslv(null)
                  }
                  if (res.isForbidden) {
                    // TODO toast
                  }

                  if (res.isOk) {
                    const url = res.body;
                    const segmentType = props.segment.type;
                    let itemToInsert = '';
                    switch (segmentType) {
                      case 'md':
                        if (file.type.includes('image')) {
                          itemToInsert = `![${filename}](${url})`
                        }
                        break;
                      case 'computational':
                      default: {
                        const prefunction = file.type.includes('image') ? 'image' : 'csv';
                        itemToInsert = `${prefunction}(${filename})`;
                        break;
                      }
                    };
                    dispatch(setUpdateFiles(true));
                    const cursorPosition = editor?.current?.view?.state.selection.main.head; // Получаем позицию курсора
                    onChange(`${tempText.slice(0, cursorPosition)}\n${itemToInsert}${tempText.slice(cursorPosition)}`)
                    reslv(null);
                  }
              }
              reader.readAsDataURL(file)
              ev.preventDefault();
            } else {
              reslv(null);
            }
          } catch (e) {
            reslv(null);
          }
        })
      }
    },
  })

  


  useEffect(() => {
    if (!editor?.current?.view) {
      return;
    }

    const view = editor.current.view;
    const docText = view.state.doc.toString(); // Получаем текст документа

    const decorations: any[] = [];
    if (typeof search === 'string') {
      let startIndex = docText.indexOf(search);
      if (search) {
        // Ищем все вхождения текста
        while (startIndex !== -1) {
          const endIndex = startIndex + search.length;
          decorations.push(Decoration.mark({ class: 'highlight-text-editor' }).range(startIndex, endIndex));
          startIndex = docText.indexOf(search, endIndex); // Ищем следующее вхождение
        }
      }
    }
    if (segmentTempErrors.length) {
      const docTextSpliitedByNewLine = docText.split('\n');
      const sortedErrors = [...segmentTempErrors].sort((a, b) => a.payload.line - b.payload.line)
      sortedErrors.forEach(segmentError => {
        const lineNumber = segmentError.payload.line;
        const row = docTextSpliitedByNewLine[segmentError.payload.line];
        const startIndex = docTextSpliitedByNewLine
          .slice(0, lineNumber)
          .reduce((total, cur) => total + cur.length + 1, 0);
      
        const endIndex = startIndex + (row?.length || 1);

        decorations.push(Decoration.mark({ class: 'highlight-text-editor-error' }).range(startIndex, endIndex));
      });
    }

    const isChunkValid = (chunk) => {
      const textLength = docText.length;
      return textLength && chunk.from >= 0 && chunk.to <= textLength && chunk.from <=textLength && chunk.from < chunk.to;
    };

    const validChunks = decorations.filter(isChunkValid);
    console.log(validChunks, docText);
    validChunks.sort((a, b) => a.from - b.from);
    const isVAlidChunkExistAndTextExist = validChunks.length && docText.length > 0;
    const decSet = Decoration.set(isVAlidChunkExistAndTextExist ? validChunks : []);
    view.dispatch({effects: setDecorationsEffect.of(decSet as any)});    
  }, [search, segmentTempErrors, editor?.current?.view]);

  const onChange = async (value) => {
    editor?.current?.view?.dispatch({ effects: setDecorationsEffect.of(Decoration.none as any) });
    await new Promise(res => setTimeout(res, 10))
    setTempText(value);
    setTempSegmentErrors([]);
    if (!isAutocompete || !projectId) {
      return;
    }
    debounceCompile(value, projectId);
  };

  const handleAddComputation = (index: number) => {
    const newSegment: Segment = {
      type: 'computational',
      parameters: {
        visible: true,
      },
      text: '',
    };
    dispatch(addSegmentAfter({segment: newSegment, after: index}))
  };

  const handleAddText = (index: number) => {
    const newSegment: Segment = {
      type: 'md',
      parameters: {
        visible: true,
      },
      text: '',
    };
    dispatch(addSegmentAfter({segment: newSegment, after: index}))
  };

  if (!isLoaded) {
    return <div/>;
  }

  return (<div>
    <div
      className={classNames('segment-editor-container',  {
        'is-active': isActiveSegment,
        'is-non-visible': props.segment.parameters.visible === false,
      })}
    >
      <CodeMirror
        ref={editor as any}
        value={tempText}
        onChange={onChange}
        readOnly={projectIsReadonly}
        extensions={[
          decorationsField,
          isHightlight ? props.segment.type === 'md' ? langs.markdown() : 
            props.segment.type === 'computational' ? customLanguageSupport :
            langs.python() : undefined,
          eventsExt,
          eventsDom,
          EditorView.lineWrapping,
          lineNumbers({
            formatNumber: (lineNo) => {
              return `${props.segment.id || '' + 1}.${lineNo}`
            },
          })
        ]
        .filter(e => !!e)}
        basicSetup={{
          lineNumbers: true,
        }}
      />
      <div className="editor-rules">
        {!projectIsReadonly &&
            <div style={{display: 'flex', flexDirection: 'row', gap: 2, alignItems: 'center'}}>
              {props.index ? <div onClick={() => onChangePosition('up')} className="change-position-button"><ArrowUp /></div> : null}
              {(props.index !== props.segmentCount -1) ? <div onClick={() => onChangePosition('down')} className="change-position-button rotate"><ArrowUp /></div> : null}
            </div>
        }
        <div className='segment-type-container'>
          <Typography
            color={colors.gray10}
            text={shortTypeMap[props.segment.type]}
          />
        </div>
        <div className="segment-position">
          <Typography type={(props.segment.id ?? 0) < 10 ? 'body' : 'label-small'} text={`${props.segment.id}`} color={colors.white} />
        </div>
        <DropdownMenu clickable={!projectIsReadonly} containerClassname="dropdown-content-contanier-additional">
          <div onClick={onDeleteSegment} className="delete-segment-container">
            <div className="delete-icon">
              <PlusIcon />
            </div>
            <Typography color={colors.gray10} text={dictionary.delete} />
          </div>
          <Checkbox
            className="full-width-checkbox"
            id={`visibility-segment-${props.index}`}
            checked={!!props.segment.parameters.visible}
            onChange={v => onChangeVisible(v, "visible")}
            title={dictionary.segment.visible}
          />
          <Checkbox hidden={props.segment.type !== 'computational'}
            className="full-width-checkbox"
            id={`valued-assignment-${props.index}`}
            checked={!!props.segment.parameters.hideAssignmentWithValues}
            onChange={v => onChangeVisible(v, "hideAssignmentWithValues")}
            title={dictionary.segment.hide_assignment_with_values}
          />
          <Checkbox hidden={props.segment.type !== 'computational'}
            className="full-width-checkbox"
            id={`array-${props.index}`}
            checked={!!props.segment.parameters.hideArray}
            onChange={v => onChangeVisible(v, "hideArray")}
            title={dictionary.segment.hide_array}
          />
          <Checkbox hidden={props.segment.type !== 'computational'}
            className="full-width-checkbox"
            id={`general-${props.index}`}
            checked={!!props.segment.parameters.hideGeneralFormula}
            onChange={v => onChangeVisible(v, "hideGeneralFormula")}
            title={dictionary.segment.hide_general_formula}
          />
          <Checkbox hidden={props.segment.type !== 'computational'}
            className="full-width-checkbox"
            id={`infl-assig-${props.index}`}
            checked={!!props.segment.parameters.hideInflAssignment}
            onChange={v => onChangeVisible(v, "hideInflAssignment")}
            title={dictionary.segment.hide_infl_assignment}
          />
          <Checkbox hidden={props.segment.type !== 'computational'}
            className="full-width-checkbox"
            id={`infl-assig-${props.index}`}
            checked={!!props.segment.parameters.hideInflAssignmentWithValues}
            onChange={v => onChangeVisible(v, "hideInflAssignmentWithValues")}
            title={dictionary.segment.hide_infl_assignment_with_values}
          />
        </DropdownMenu>
      </div>
    </div>
  <div style={{ flex: 1, marginTop: -10 }}>
    {props.index + 1 !== props.segmentCount && (
        <SegmentDivider
            onAddComputation={() => handleAddComputation(props.index)}
            onAddText={() => handleAddText(props.index)}
        />
    )}
  </div></div>
  );
});
