import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { LOGOUT_TYPE } from '../../actions';
import { setUserState, STATE_ONLINE } from '../../../shared/yandex-metrika';

export interface UserInfo {
    email: string;
    id: number;
    isAuthenticated?: boolean;
    yandexCaptchaSiteKey?: string;
    oauthProviders?: string[];
}

const initialState: UserInfo = {
    isAuthenticated: false,
    email: '',
    id: 0,
    yandexCaptchaSiteKey: '',
    oauthProviders: [],
};

export const userSlice = createSlice({
    name: 'userSlice',
    initialState,
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
            state.yandexCaptchaSiteKey = payload.yandexCaptchaSiteKey;
            state.oauthProviders = payload.oauthProviders;

            if (state.isAuthenticated) {
                setUserState(STATE_ONLINE, 'online');
            } else {
                setUserState(STATE_ONLINE, 'anonymous');
            }
        },
        clearUser: (state) => {
            state = initialState;
            return state;
        },
    },
    extraReducers: (b) => {
        b.addCase(LOGOUT_TYPE, (state) => {
            state = initialState;
            return state;
        });
    },
});
export const { setUser, clearUser } = userSlice.actions;
export const { selectAll, selectIsAuthenticated, selectEmail } =
    userSlice.selectors;
