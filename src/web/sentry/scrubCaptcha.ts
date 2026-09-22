// BaseLayout берёт токен обхода капчи через searchParams.get('captcha'): имя с учётом регистра и после декодирования
const CAPTCHA_PARAM = 'captcha';
export const FILTERED_VALUE = '[Filtered]';

// параметр в начале строки, после '?', '&' или пробела; значение обрывается и на '?', чтобы найти вложенный адрес
// на апострофе значение не обрывается: encodeURIComponent и axios его не кодируют, и хвост токена ушёл бы в событие
const QUERY_PARAM = /(^|[?&\s])([^=&#?\s"'<>`\\]+)=([^&#?\s"<>`\\]*)/g;

function isCaptchaName(name: string): boolean {
    try {
        return decodeURIComponent(name.replace(/\+/g, ' ')) === CAPTCHA_PARAM;
    } catch {
        // URLSearchParams оставляет битую последовательность как есть, и такое имя уже не captcha
        return false;
    }
}

/** Заменяет значение параметра captcha в адресе, строке запроса или тексте с адресом. */
export function scrubCaptcha(text: string): string {
    return text.replace(
        QUERY_PARAM,
        (param, prefix: string, name: string, value: string) =>
            value && isCaptchaName(name)
                ? `${prefix}${name}=${FILTERED_VALUE}`
                : param
    );
}

function isPlainObject(value: object): value is Record<string, unknown> {
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

/** Копия значения, где вычищены все строки, ключи captcha и пары [captcha, значение] из query_string. */
export function scrubCaptchaDeep<T>(value: T): T {
    return scrubValue(value, new Map()) as T;
}

function scrubValue(value: unknown, copies: Map<object, unknown>): unknown {
    if (typeof value === 'string') {
        return scrubCaptcha(value);
    }
    if (!value || typeof value !== 'object') {
        return value;
    }
    // ошибку из beforeSend Sentry шлёт отдельным событием уже мимо него, поэтому обход не падает и на циклах
    if (copies.has(value)) {
        return copies.get(value);
    }
    if (Array.isArray(value)) {
        // та же длина и запись по индексу: дыры разреженного массива остаются на местах, как их держит normalize
        const copy: unknown[] = new Array(value.length);
        copies.set(value, copy);
        const isCaptchaPair =
            value.length === 2 &&
            typeof value[0] === 'string' &&
            typeof value[1] === 'string' &&
            value[1] !== '' &&
            isCaptchaName(value[0]);
        value.forEach((item, index) => {
            copy[index] =
                isCaptchaPair && index === 1
                    ? FILTERED_VALUE
                    : scrubValue(item, copies);
        });
        return copy;
    }
    // Date, Error и прочие экземпляры не трогаем: в нормализованном событии их нет, а копия потеряла бы их смысл
    if (!isPlainObject(value)) {
        return value;
    }
    const copy: Record<string, unknown> = {};
    copies.set(value, copy);
    for (const [key, item] of Object.entries(value)) {
        copy[key] =
            typeof item === 'string' && item !== '' && isCaptchaName(key)
                ? FILTERED_VALUE
                : scrubValue(item, copies);
    }
    return copy;
}
