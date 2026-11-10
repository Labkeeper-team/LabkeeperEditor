import type { Language } from '../viewModel/dictionaries';

/**
 * Язык интерфейса, который уходит серверу в Accept-Language каждого запроса.
 * Без него сервер видел язык браузера: человек выбрал китайский, а суффикс
 * копии проекта, имя импортированного проекта и письмо об оплате приходили
 * на языке браузера
 */
let requestLanguage: Language | undefined;

export function setRequestLanguage(language: Language) {
    requestLanguage = language;
}

export function getRequestLanguage(): Language | undefined {
    return requestLanguage;
}
