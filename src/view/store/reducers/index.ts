import { combineReducers } from '@reduxjs/toolkit';
import { persistReducer } from 'redux-persist';
import storage from '../persistStorage.ts';
import { projectsSlice } from '../slices/projects';
import { projectSlice } from '../slices/project';
import { settingsSlice } from '../slices/settings';
import { userSlice } from '../slices/user';
import { callbackSlice } from '../slices/callback';
import { ideSlice } from '../slices/ide';
import { authSlice } from '../slices/auth';
import { persistenceSlice } from '../slices/persistence';
import { billingSlice } from '../slices/billing';
import { chatSlice } from '../slices/chat';

const LOCAL_STORAGE_KEY = 'PERSISTENCE';

export const createRootReducer = () => {
    return combineReducers({
        ide: ideSlice.reducer,
        projects: projectsSlice.reducer,
        project: projectSlice.reducer,
        settings: settingsSlice.reducer,
        user: userSlice.reducer,
        auth: authSlice.reducer,
        billing: billingSlice.reducer,
        chat: chatSlice.reducer,
        persistence: persistReducer(
            {
                key: LOCAL_STORAGE_KEY,
                storage,
                blacklist: [],
            },
            persistenceSlice.reducer
        ),
        callback: callbackSlice.reducer,
    });
};
