import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { act, render, screen } from '@testing-library/react';
import {
    collabSlice,
    setCollabParticipants,
    setCollabStatus,
    setCollabWelcome,
    setCollabMaxParticipants,
    setCollabParticipantLimit,
} from '../../../view/store/slices/collab';
import {
    CollabParticipantLimitNotice,
    CollabParticipants,
} from '../../../view/components/collabParticipants';
import {
    orderParticipants,
    participantInitials,
} from '../../../view/components/collabParticipants/participants.ts';

const alice = {
    userId: 1,
    displayName: 'alice.smith',
    color: '#e8590c',
    connectionIds: ['c-1'],
};
const bob = {
    userId: 2,
    displayName: 'bob',
    color: '#1971c2',
    connectionIds: ['c-2', 'c-3'],
};

function makeStore(language: 'en' | 'ru' = 'en') {
    return configureStore({
        reducer: {
            collab: collabSlice.reducer,
            persistence: (state = { language }) => state,
        },
    });
}

describe('collab participants', () => {
    test('initials come from the name parts', () => {
        expect(participantInitials('alice.smith')).toBe('AS');
        expect(participantInitials('bob')).toBe('BO');
        expect(participantInitials('')).toBe('?');
    });

    test('the list is deduplicated by user and starts with the current user', () => {
        expect(
            orderParticipants([alice, bob, { ...bob }], 2).map((p) => p.userId)
        ).toEqual([2, 1]);
    });

    test('participantsChanged replaces the whole list', () => {
        const store = makeStore();
        store.dispatch(setCollabParticipants([alice, bob]));
        store.dispatch(setCollabParticipants([bob]));
        expect(store.getState().collab.participants).toEqual([bob]);
    });

    test('renders one colored avatar per user, the current user marked as you', () => {
        const store = makeStore();
        store.dispatch(setCollabStatus('live'));
        store.dispatch(
            setCollabWelcome({
                selfUserId: 2,
                selfConnectionId: 'c-2',
                canWrite: true,
                locked: false,
            })
        );
        store.dispatch(setCollabParticipants([alice, bob]));
        render(
            <Provider store={store}>
                <CollabParticipants />
            </Provider>
        );
        const avatars = screen.getAllByTestId('collab-participant');
        expect(avatars).toHaveLength(2);
        expect(avatars[0].getAttribute('title')).toBe('bob (you)');
        expect(avatars[0].textContent).toBe('BO');
        expect(avatars[0].style.backgroundColor).toBe('rgb(25, 113, 194)');
        expect(avatars[1].getAttribute('title')).toBe('alice.smith');
        expect(avatars[1].textContent).toBe('AS');

        // alice leaves
        act(() => {
            store.dispatch(setCollabParticipants([bob]));
        });
        expect(screen.getAllByTestId('collab-participant')).toHaveLength(1);
    });

    test('renders nothing while the session is off', () => {
        const store = makeStore();
        store.dispatch(setCollabParticipants([alice]));
        const { container } = render(
            <Provider store={store}>
                <CollabParticipants />
            </Provider>
        );
        expect(container.innerHTML).toBe('');
    });
});

describe('collab participant limit', () => {
    test('the refusal is shown with the limit, in the user language', () => {
        const store = makeStore('en');
        const { rerender } = render(
            <Provider store={store}>
                <CollabParticipantLimitNotice />
            </Provider>
        );
        expect(screen.queryByTestId('collab-participant-limit')).toBeNull();
        act(() => {
            store.dispatch(setCollabParticipantLimit(5));
        });
        expect(screen.getByTestId('collab-participant-limit').textContent).toBe(
            'This project already has 5 people editing. Try again when someone leaves.'
        );

        const ru = makeStore('ru');
        ru.dispatch(setCollabParticipantLimit(3));
        rerender(
            <Provider store={ru}>
                <CollabParticipantLimitNotice />
            </Provider>
        );
        expect(
            screen.getByTestId('collab-participant-limit').textContent
        ).toContain('уже редактируют 3 человек');
    });

    test('the participant list tells how many of the maximum are editing', () => {
        const store = makeStore();
        store.dispatch(setCollabStatus('live'));
        store.dispatch(setCollabMaxParticipants(5));
        store.dispatch(setCollabParticipants([alice, bob]));
        render(
            <Provider store={store}>
                <CollabParticipants />
            </Provider>
        );
        expect(
            screen.getByTestId('collab-participants').getAttribute('title')
        ).toBe('2 of 5 people editing');
    });
});
