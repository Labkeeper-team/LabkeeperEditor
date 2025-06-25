import { AuthState } from './auth';
import { IdeState } from './ide';
import { PersistenceState } from './persistence';
import { Program } from '../../../model/domain.ts';
import { ProjectState } from './project';
import { ProjectsState } from './projects';
import { SettingsState } from './settings';
import { UserInfo } from './user';
import { CallbackState } from './callback';

export const authInitialState: AuthState = {
    isRegistration: true,
    currentView: 'login',
    currentEmail: null,
    lastVerifiedCode: null,
    emailRequest: 'unknown',
    codeCheckRequest: 'unknown',
    passwordSetRequest: 'unknown',
    authErrorMessage: null,
    showAuthModal: false,
};

export const ideInitialState: IdeState = {
    search: undefined,
    activeSegmentIndex: -1,
    previousActiveSegmentIndex: -1,
};

export const initialProgram: Program = {
    segments: [],
    parameters: {
        roundStrategy: 'firstMeaningDigit',
    },
};

export const persistenceInitialState: PersistenceState = {
    language: navigator.language.includes('ru') ? 'ru' : 'en',
    lastProgram: initialProgram,
    instructionExpanded: true,
};

export const projectInitialState: ProjectState = {
    compileErrorResult: { errors: [] },
    projectIsReadonly: true,
    files: [],
    currentProgram: {
        segments: [],
        parameters: {
            roundStrategy: 'firstMeaningDigit',
        },
    },
};

export const projectsInitialState: ProjectsState = {
    projects: [],
};

export const settingsInitialState: SettingsState = {
    showTour: false,
    showFileManager: false,
    showSearch: false,
    editModeForProjectTitle: false,
    editModeForFilename: false,
    expandProblemViewer: false,
    isFileDraggedToManager: false,
    isCompiling: false,
    showShareModal: false,
};

export const userInitialState: UserInfo = {
    isAuthenticated: false,
    email: '',
    id: 0,
};

export const callbackInitialState: CallbackState = {
    navigateTo: undefined,
    showToastMessage: undefined,
    toastType: undefined,
    scrollEditorToBottom: false,
};
