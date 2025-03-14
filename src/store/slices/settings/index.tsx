import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { LOGOUT_TYPE } from '../../actions';
import { Language } from '../../shared/dictionaries';


export interface SettingsState {
  showTour: boolean;
  showFileManager: boolean;
  expandProblemViewer: boolean;
  showSearch: boolean;
  editModeForProjectTitle: boolean;
  editModeForFilename: boolean;
  language: Language;
  isFileDraggedToManager: boolean;
  isAutompleteLoading: boolean;
}

const initialState: SettingsState = {
  showTour: false,
  showFileManager: false,
  showSearch: false,
  editModeForProjectTitle: false,
  editModeForFilename: false,
  expandProblemViewer: false,
  isFileDraggedToManager: false,
  language: 'ru',
  isAutompleteLoading: false,
};

export const settingsSlice = createSlice({
  name: 'settingsSlice',
  initialState,
  reducers: {
    setAutoCompleteLoading: (state, {payload}: PayloadAction<boolean>) => {
      state.isAutompleteLoading = payload;
    },
    setEditModeForProjectTitle: (state, { payload }: PayloadAction<boolean>) => {
      state.editModeForProjectTitle = payload;
    },
    setEditModeForFilename: (state, { payload }: PayloadAction<boolean>) => {
      state.editModeForFilename = payload;
    },
    setTourVisibility: (state, { payload }: PayloadAction<boolean>) => {
      state.showTour = payload;
    },
    setLanguage: (state, {payload}: PayloadAction<Language>) => {
      state.language = payload;
    },
    setExpandProblemViewer: (state, {payload}: PayloadAction<boolean>) => {
      state.expandProblemViewer = payload;
    },
    setShowSearch: (state, {payload}: PayloadAction<boolean>) => {
      state.showSearch = payload;
    },
    setShoFileManager: (state, {payload}: PayloadAction<boolean>) => {
      state.showFileManager = payload;
    },
    setisFileDraggedToFileManager: (state, {payload}: PayloadAction<boolean>) => {
      state.isFileDraggedToManager = payload;
    }
  },
  extraReducers: (b) => {
    b.addCase(LOGOUT_TYPE, (state) => {
      const newLogoutState = {...initialState};
      newLogoutState.language = state.language;
      state = newLogoutState;
      return state;
    });
  },
});
export const { setEditModeForProjectTitle, setAutoCompleteLoading, setEditModeForFilename, setShowSearch, setExpandProblemViewer, setTourVisibility, setLanguage, setShoFileManager, setisFileDraggedToFileManager } = settingsSlice.actions;
