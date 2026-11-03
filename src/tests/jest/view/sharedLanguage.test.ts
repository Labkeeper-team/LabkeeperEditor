import { configureStore } from '@reduxjs/toolkit';
import {
    persistenceSlice,
    setLanguage,
} from '../../../view/store/slices/persistence';
import {
    SHARED_LANGUAGE_KEY,
    syncSharedLanguage,
} from '../../../view/store/sharedLanguage.ts';

/** GH-175: язык общий у редактора и сайта, сайт держит его в labkeeper_lang */

const storeWith = (language: 'ru' | 'en') => {
    const store = configureStore({
        reducer: { persistence: persistenceSlice.reducer },
    });
    store.dispatch(setLanguage(language));
    return store;
};

beforeEach(() => window.localStorage.clear());

test('язык, выбранный на сайте, главнее сохранённого в редакторе', () => {
    window.localStorage.setItem(SHARED_LANGUAGE_KEY, 'en');
    const store = storeWith('ru');

    syncSharedLanguage(store);

    expect(store.getState().persistence.language).toBe('en');
    expect(window.localStorage.getItem(SHARED_LANGUAGE_KEY)).toBe('en');
});

test('без выбора на сайте сайту уходит язык редактора', () => {
    const store = storeWith('en');

    syncSharedLanguage(store);

    expect(store.getState().persistence.language).toBe('en');
    expect(window.localStorage.getItem(SHARED_LANGUAGE_KEY)).toBe('en');
});

// так было в задаче: редактор переключили на английский и обратно, а сайт остался на английском
test('каждая смена языка в редакторе уходит сайту', () => {
    const store = storeWith('ru');
    syncSharedLanguage(store);

    store.dispatch(setLanguage('en'));
    expect(window.localStorage.getItem(SHARED_LANGUAGE_KEY)).toBe('en');

    store.dispatch(setLanguage('ru'));
    expect(window.localStorage.getItem(SHARED_LANGUAGE_KEY)).toBe('ru');
});

test('чужое значение под ключом не меняет язык редактора', () => {
    window.localStorage.setItem(SHARED_LANGUAGE_KEY, 'de');
    const store = storeWith('ru');

    syncSharedLanguage(store);

    expect(store.getState().persistence.language).toBe('ru');
    expect(window.localStorage.getItem(SHARED_LANGUAGE_KEY)).toBe('ru');
});
