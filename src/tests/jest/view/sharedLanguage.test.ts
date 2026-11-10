import { configureStore } from '@reduxjs/toolkit';
import {
    persistenceSlice,
    setLanguage,
} from '../../../view/store/slices/persistence';
import {
    SHARED_LANGUAGE_KEY,
    syncSharedLanguage,
} from '../../../view/store/sharedLanguage.ts';
import type { Language } from '../../../viewModel/dictionaries';
import { getRequestLanguage } from '../../../web/requestLanguage.ts';

/** GH-175: язык общий у редактора и сайта, сайт держит его в labkeeper_lang */

const storeWith = (language: Language) => {
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

test('китайский, выбранный на сайте, доходит до редактора', () => {
    window.localStorage.setItem(SHARED_LANGUAGE_KEY, 'zh');
    const store = storeWith('en');

    syncSharedLanguage(store);

    expect(store.getState().persistence.language).toBe('zh');
});

test('атрибут lang страницы следует за языком редактора', () => {
    const store = storeWith('zh');
    syncSharedLanguage(store);
    expect(document.documentElement.lang).toBe('zh-CN');

    store.dispatch(setLanguage('ru'));
    expect(document.documentElement.lang).toBe('ru');
});

// без этого сервер брал язык браузера: копия проекта и письмо об оплате приходили не на том языке
test('язык редактора уходит в Accept-Language запросов к серверу', () => {
    const store = storeWith('zh');
    syncSharedLanguage(store);
    expect(getRequestLanguage()).toBe('zh');

    store.dispatch(setLanguage('en'));
    expect(getRequestLanguage()).toBe('en');
});
