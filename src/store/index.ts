import { AnyAction, configureStore, ThunkAction } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import {
    persistStore,
    PERSIST,
    FLUSH,
    REHYDRATE,
    PAUSE,
    PURGE,
    REGISTER,
} from 'redux-persist';
import { createRootReducer } from './reducers';

export const store = configureStore({
    reducer: createRootReducer(),
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                ignoredActions: [
                    FLUSH,
                    REHYDRATE,
                    PAUSE,
                    PERSIST,
                    PURGE,
                    REGISTER,
                ],
            },
        }),
    // devTools: process.env.NODE_ENV !== 'production',
});

setupListeners(store.dispatch);

export const persist = persistStore(store);

export type StorageState = ReturnType<ReturnType<typeof createRootReducer>>;

export type AppDispatch = typeof store.dispatch;

export type AppThunk<R = void> = ThunkAction<
    R | Promise<R>,
    StorageState,
    unknown,
    AnyAction
>;
