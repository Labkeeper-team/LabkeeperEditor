import { useRef, useState } from 'react';
import { Typography } from '../../../componenets/typography';
import { PencilIcon } from '../../../shared/icons';
import { ProjectTItleProps } from './model';

import './style.scss';
import { Input } from '../../../componenets/input';
import { colors } from '../../../shared/styles/colors';

import { useHotkeys } from 'react-hotkeys-hook';
import {setTitleRequest} from "../../../rpi/project.tsx";
import {logoutAction} from "../../../store/actions";
import {useDispatch, useSelector} from "react-redux";
import { toast } from 'react-toastify';
import { useDictionary } from '../../../store/selectors/translations';

export const ProjectTitle = (props: ProjectTItleProps) => {
  const ref = useRef<HTMLInputElement>(null);
  const dictionary = useSelector(useDictionary);
  const [editMode, setEditMode] = useState(false);
  const [currentTitle, setCurrentTitle] = useState(props.project.title);
  const dispatch = useDispatch()

  const onClickChange = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setEditMode(true);
    setTimeout(() => {
      ref.current?.focus();
    }, 100);
  };

  const onInputBlur = async () => {
    let needToSetCurrentTitleAtTheEnd = true;

      const titleToSend = currentTitle?.trim();
      if (!titleToSend) {
        toast(dictionary.projects.errors.empty_name, {type: 'error'});
        setCurrentTitle(props.project.title)
        needToSetCurrentTitleAtTheEnd = false;
      }
      if (titleToSend !== props.project.title && !!titleToSend) {
        const result = await setTitleRequest(props.project.projectId?.toString(), currentTitle)
        if (!result.isOk) {
          setCurrentTitle(props.project.title);
          needToSetCurrentTitleAtTheEnd = false;
        }
        if (result.isUnauth) {
          toast(dictionary.filemanager.errors.sessionExpired, {type: 'error'});
          dispatch(logoutAction)
        }
      }

      if (!needToSetCurrentTitleAtTheEnd) {
        setEditMode(false);
        return;
      }
      props?.onSuccessRename?.();
      setCurrentTitle(currentTitle);
      setEditMode(false);
  };


  useHotkeys('esc', () => {
    setCurrentTitle(props.project.title);
    setEditMode(false)
  }, {enableOnFormTags: true})

  return (
    <div className="project-title-container">
      {editMode ? (
        <Input
          ref={ref}
          value={currentTitle}
          onBlur={onInputBlur}
          onKeyDown={(e) => e.key === 'Enter' ? onInputBlur() : () => {}}
          onChange={(e) => setCurrentTitle(e.target.value)}
        />
      ) : (
        <>
          <Typography className='text-base ' color={colors.gray10} text={currentTitle} type='body-large' />
          <div onClick={onClickChange} className="change-icon-container">
          <PencilIcon />
        </div>
      </>
      )}

    </div>
  );
};
