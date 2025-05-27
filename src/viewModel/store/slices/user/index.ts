import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { LOGOUT_TYPE } from '../../actions';
import { userInitialState } from '../index.ts';
import { observerService } from '../../../../main.tsx';
import { States } from '../../../../model/service/observer.ts';

export interface UserInfo {
    email: string;
    id: number;
    isAuthenticated: boolean;
}

export const userSlice = createSlice({
    name: 'userSlice',
    initialState: userInitialState,
    selectors: {
        selectAll: (state) => state,
        selectIsAuthenticated: (state) => state.isAuthenticated,
        selectEmail: (state) => state.email,
    },
    reducers: {
        setUser: (state, { payload }: PayloadAction<UserInfo>) => {
            state.email = payload.email;
            state.isAuthenticated = payload.isAuthenticated;
            state.id = payload.id;

            if (state.isAuthenticated) {
                observerService.setUserState(States.STATE_ONLINE, 'online');
            } else {
                observerService.setUserState(States.STATE_ONLINE, 'anonymous');
            }
        },
        clearUser: (state) => {
            state = userInitialState;
            return state;
        },
    },
    extraReducers: (b) => {
        b.addCase(LOGOUT_TYPE, (state) => {
            state = userInitialState;
            return state;
        });
    },
});
export const { setUser, clearUser } = userSlice.actions;
export const { selectAll, selectIsAuthenticated, selectEmail } =
    userSlice.selectors;
