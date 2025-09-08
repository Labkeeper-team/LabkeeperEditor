import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { userInitialState } from '../index.ts';
import { UserInfo } from '../../../../model/domain.ts';

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
        },
    },
});
export const { setUser } = userSlice.actions;
