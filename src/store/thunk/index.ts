import { createAsyncThunk } from '@reduxjs/toolkit';
import {StorageState} from '..';
import {setCompileError, setCompileResult} from '../slices/project';
import { setNeedLogin } from '../slices/ide';
import { setAutoCompleteLoading } from '../slices/settings';
import {compilationRequest, compileProjectRequest} from "../../rpi/compilation.tsx";
import {RequestResult} from "../../rpi";
import {toast} from "react-toastify";
import {dictionary} from "../shared/dictionaries";
import {logoutAction} from "../actions";

export const compileProject = createAsyncThunk(
  'project/compileProject',
  async (_, thunkAPI) => {
      const state = thunkAPI.getState() as StorageState;
      const isAuthenticated = state.user.isAuthenticated;
      const projectId = state.project.project?.projectId;
      const program = state.project.history[state.project.historyAcitveIndex];

      thunkAPI.dispatch(setAutoCompleteLoading(true));

      let result: RequestResult;
      if (projectId && isAuthenticated) {
          result = await compileProjectRequest(projectId)
      } else {
          result = await compilationRequest(program)
      }

      thunkAPI.dispatch(setAutoCompleteLoading(false));

      if (result.code >= 500) {
          toast(dictionary[state.settings.language].filemanager.errors.internalError, {type: 'error'});
          thunkAPI.dispatch(logoutAction)
      }
      if (result.code === 401 || result.code === 403) {
          toast(dictionary[state.settings.language].filemanager.errors.sessionExpired, {type: 'error'});
          thunkAPI.dispatch(logoutAction)
      }
      if (result.code === 200) {
          thunkAPI.dispatch(setCompileResult(result.body));
      }
      if (result.code === 203) {
          thunkAPI.dispatch(setCompileError(result.body));
      }
      if (result.code === 425) {
          thunkAPI.dispatch(setNeedLogin(true));
      }
  }
);
