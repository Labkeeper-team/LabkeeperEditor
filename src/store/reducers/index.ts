import { combineReducers } from '@reduxjs/toolkit';
import { persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { LocalStorageKeys } from '../../utils/localStorageKeys';
import { projectsSlice } from '../slices/projects';
import { projectSlice } from '../slices/project';
import { settingsSlice } from '../slices/settings';
import { userSlice } from '../slices/user';
import { ideSlice } from '../slices/ide';
import { authSlice } from '../slices/auth';
import { persistenceSlice } from '../slices/persistence';

export const createRootReducer = () => {
    return combineReducers({
        ide: ideSlice.reducer,
        projects: projectsSlice.reducer,
        project: projectSlice.reducer,
        settings: settingsSlice.reducer,
        user: userSlice.reducer,
        auth: authSlice.reducer,
        persistence: persistReducer(
            {
                key: LocalStorageKeys.persistence,
                storage,
                blacklist: [],
            },
            persistenceSlice.reducer
        ),
    });
};
