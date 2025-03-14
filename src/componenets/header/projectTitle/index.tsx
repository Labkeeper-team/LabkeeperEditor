/* eslint-disable @typescript-eslint/no-explicit-any */
import { useDispatch, useSelector } from "react-redux"
import { toast } from "react-toastify"
import { useCurrentProject } from "../../../store/selectors/program"
import { useEffect, useRef, useState } from "react"
import { PencilIcon } from "../../../shared/icons"

import './style.scss';
import classNames from "classnames"
import { setProjectName } from "../../../store/slices/project"
import { StorageState } from "../../../store"
import { setEditModeForProjectTitle } from "../../../store/slices/settings"
import {setTitleRequest} from "../../../rpi/project.tsx";
import {useDictionary} from "../../../store/selectors/translations.ts";
import {logoutAction} from "../../../store/actions";

export const ProjectTitle = () => {
    const project = useSelector(useCurrentProject)
    const [currentTitle, setCurrentTitle]  = useState(project?.title);
    const editMode = useSelector((state: StorageState) => state.settings.editModeForProjectTitle);
    const dictionary = useSelector(useDictionary);
    const dispatch = useDispatch();
    const inputRef = useRef<HTMLInputElement>();
    const setEditMode = (value: boolean) => {
      dispatch(setEditModeForProjectTitle(value))
    }

    useEffect(() => {
      if (!editMode) {
        setCurrentTitle(project?.title);
      }
    }, [editMode]);
  
    useEffect(() => {
        if (!project?.title) {
            return;
        }

        setCurrentTitle(project?.title);
    }, [project?.title])

    const onInputBlur = async () => {
        if (!project?.projectId) {
            return;
        }

        let needToSetCurrentTitleAtTheEnd = true;

        const titleToSend = currentTitle?.trim();
        if (!titleToSend) {
            needToSetCurrentTitleAtTheEnd = false;
            toast(dictionary.projects.errors.empty_name, {type: 'error'});
        }
        if (titleToSend !== project.title && !!titleToSend) {
          const result = await setTitleRequest(project.projectId?.toString(), currentTitle)
          if (result.isUnauth) {
              toast(dictionary.filemanager.errors.sessionExpired, {type: 'error'});
              dispatch(logoutAction)
          }
          if (result.isForbidden) {
              // TODO show toast
          }
          if (result.isOk) {
              dispatch(setProjectName(titleToSend));
          }
          if (!result.isOk) {
              setCurrentTitle(project.title);
              needToSetCurrentTitleAtTheEnd = false;
          }
        }

        setEditMode(false);
        if (needToSetCurrentTitleAtTheEnd) {
            setCurrentTitle(currentTitle);
        }
    };

    const onPressPencil = () => {
        if (editMode) {
            return;
        }
        setEditMode(true);
        setTimeout(() => {
            inputRef?.current?.select();
        }, 200);

    }

    useEffect(() => {
      if (!editMode) {
        if (window.getSelection) {
          window.getSelection()?.removeAllRanges();
        }
        inputRef?.current?.blur();
      }
    }, [editMode])
  
    const onKeyDown = (e) => {
      if (e.key === 'Enter') {
       e.currentTarget.blur();
      }
    }

    if (!project || !project.title) {
        return null;
    }
    
    return <div className="change-title-container">
        <input
            ref={inputRef as any}
            value={currentTitle}
            onChange={editMode ? (e) => setCurrentTitle(e.target.value) : undefined}
            onBlur={editMode ? onInputBlur : undefined}
            onKeyDown={editMode ? onKeyDown : undefined}
            disabled={!editMode}
            className={`${classNames('change-title-input', {disabled: !editMode})}`}
        />
        <div onClick={onPressPencil} className={classNames('change-titlepress-button', {'edit-mode-on': editMode})}>
            <PencilIcon />
        </div>
    </div>
}