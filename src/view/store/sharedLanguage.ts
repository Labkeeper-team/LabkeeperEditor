import type { Store } from '@reduxjs/toolkit';
import { isLanguage, type Language } from '../../viewModel/dictionaries';
import { setLanguage } from './slices/persistence';
import { setRequestLanguage } from '../../web/requestLanguage.ts';

/**
 * GH-175: язык общий у редактора и страниц сайта. Сайт хранит его в
 * localStorage под этим ключом, а редактор в своём срезе, и раньше они друг
 * друга не читали: язык, выбранный в редакторе, не доходил до главной и
 * страницы «О нас», а выбранный там не доходил до редактора
 */
export const SHARED_LANGUAGE_KEY = 'labkeeper_lang';

export const readSharedLanguage = (): Language | null => {
    try {
        const value = window.localStorage.getItem(SHARED_LANGUAGE_KEY);
        return isLanguage(value) ? value : null;
    } catch {
        // хранилище закрыто, например в приватном окне Safari: остаётся язык редактора
        return null;
    }
};

/** Язык страницы для браузера: по нему выбираются начертания иероглифов, чтение вслух и предложение перевести */
const HTML_LANG: Record<Language, string> = {
    ru: 'ru',
    en: 'en',
    zh: 'zh-CN',
};

const writeSharedLanguage = (language: Language) => {
    try {
        window.localStorage.setItem(SHARED_LANGUAGE_KEY, language);
    } catch {
        // без хранилища сайт возьмёт свой язык по умолчанию
    }
};

type LanguageStore = Pick<
    Store<{ persistence: { language: Language } }>,
    'getState' | 'dispatch' | 'subscribe'
>;

/**
 * Зовётся, когда срез редактора восстановлен. Язык, выбранный на сайте,
 * главнее сохранённого в редакторе. Дальше язык редактора, выбранный
 * человеком или взятый из браузера, уходит сайту, запросам к серверу и
 * атрибуту lang страницы при каждой смене
 */
export const syncSharedLanguage = (store: LanguageStore) => {
    const shared = readSharedLanguage();
    if (shared && shared !== store.getState().persistence.language) {
        store.dispatch(setLanguage(shared));
    }
    let written: Language | null = null;
    const write = () => {
        const { language } = store.getState().persistence;
        if (language !== written) {
            written = language;
            writeSharedLanguage(language);
            setRequestLanguage(language);
            document.documentElement.lang = HTML_LANG[language];
        }
    };
    write();
    store.subscribe(write);
};
