import { useNavigate, useParams } from 'react-router-dom';

import './style.scss';
import { Editor } from './editor';
import { Viewer } from './viewer';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {setCompileError, setCompileResult, setNewProgram, setProject, setReadOnly} from '../../store/slices/project';
import { Project } from '../../shared/models/project';
import {
  useCurrentProject,
  useUser, useShowTour
} from '../../store/selectors/program';
import { Routes } from '../../routing/routes';
import { FileManager } from './fileManager';
import { StorageState } from '../../store';
import { useHotkeys } from 'react-hotkeys-hook';
import { setEditModeForFilename, setEditModeForProjectTitle, setExpandProblemViewer, setShoFileManager, setShowSearch, setTourVisibility } from '../../store/slices/settings';
import { setSearch } from '../../store/slices/ide';
import {getDefaultProjectRequest, getProjectRequest} from "../../rpi/project.tsx";
import {toast} from "react-toastify";
import {useCurrentLanguge, useDictionary} from "../../store/selectors/translations.ts";
import {logoutAction} from "../../store/actions";


export const ProjectPage = () => {
  const { id } = useParams<{ id: string }>();
  const user = useSelector(useUser);
  const project = useSelector(useCurrentProject);
  const dispatch = useDispatch();

  const showTour = useSelector(useShowTour);
  const expandedProblemViewer = useSelector((state: StorageState) => state.settings.expandProblemViewer);
  const showFileManager = useSelector((state: StorageState) => state.settings.showFileManager);
  const showSearch = useSelector((state: StorageState) => state.settings.showSearch);
  const editModeForProjectTitle = useSelector((state: StorageState) => state.settings.editModeForProjectTitle);
  const globalEditFileMode = useSelector((state: StorageState) => state.settings.editModeForFilename);
  const dictionary = useSelector(useDictionary)
  const language = useSelector(useCurrentLanguge)

  const navigate = useNavigate();

  const onMultiClose = () => {
    if (showTour) {
      dispatch(setTourVisibility(false));
      return;
    }
    if (globalEditFileMode) {
      dispatch(setEditModeForFilename(false));
      return;
    }
    if (editModeForProjectTitle) {
      dispatch(setEditModeForProjectTitle(false));
      return;
    }
    if (showSearch) {
      dispatch(setSearch(''));
      dispatch(setShowSearch(false));
      return;
    }
    if (expandedProblemViewer) {
      dispatch(setExpandProblemViewer(false));
      return;
    }
    if (showFileManager) {
      dispatch(setShoFileManager(false));
      return;
    }
  }
  useHotkeys('esc',onMultiClose, {enableOnFormTags: true, enabled: true, enableOnContentEditable: true})

  useEffect(() => {
    if (!id) {
      return;
    }
    const projectId = +id;
    if (isNaN(projectId)) {
      if (user.isAuthenticated && !project) {
        const createDefaultProject = async () => {
            const result = await getDefaultProjectRequest(language); // TODO send program
            if (result.isOk) {
              dispatch(setProject(result.body as any));
              dispatch(setNewProgram(result.body.program));
              dispatch(setCompileResult(undefined));
              dispatch(setCompileError({errors: []}));
              navigate(Routes.Project.replace(':id', result.body.projectId));
            }
            if (result.isUnauth) {
              toast(dictionary.filemanager.errors.sessionExpired, {type: 'error'});
              dispatch(logoutAction)
            }
        };
        createDefaultProject();
      }
      return;
    }

    const getProject = async () => {
      const result = await getProjectRequest(projectId.toString())
      if (result.isUnauth) {
        toast(dictionary.filemanager.errors.sessionExpired, {type: 'error'});
        dispatch(logoutAction)
      }
      if (result.isOk) {
        dispatch(setProject(result.body as Project));
        dispatch(setReadOnly(user.id !== (result.body as Project).userId))
        dispatch(setNewProgram(result.body.program));
      }
    };
    getProject();
  }, [id, user.isAuthenticated]);


  return (
    <div className="project-container">
      <FileManager />
      <Editor />
      <Viewer />
    </div>
  );
};
