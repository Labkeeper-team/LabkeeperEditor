/**
 * Подмены для старых браузеров, у которых этих функций ещё нет, а мы и
 * библиотеки их зовём: structuredClone появился в Chrome 98, crypto.randomUUID
 * и .at() в 92, Object.hasOwn в 93. В Bugsink приходили Chrome 86 и 95,
 * редактор у них не открывался вовсе. .at(-1) зовут pdf.js и
 * react-hotkeys-hook при регистрации сочетаний
 *
 * Подключаются первым импортом main.tsx и в воркере pdf.js. Где функция есть,
 * ничего не меняется
 */

const cloneValue = (value: unknown, seen: Map<object, unknown>): unknown => {
    if (value === null || typeof value !== 'object') {
        return value;
    }
    if (seen.has(value)) {
        return seen.get(value);
    }
    if (value instanceof Date) {
        return new Date(value.getTime());
    }
    if (value instanceof RegExp) {
        return new RegExp(value.source, value.flags);
    }
    if (ArrayBuffer.isView(value)) {
        const view = value as unknown as { slice: () => unknown };
        return view.slice();
    }
    if (value instanceof Map) {
        const copy = new Map();
        seen.set(value, copy);
        value.forEach((item, key) =>
            copy.set(cloneValue(key, seen), cloneValue(item, seen))
        );
        return copy;
    }
    if (value instanceof Set) {
        const copy = new Set();
        seen.set(value, copy);
        value.forEach((item) => copy.add(cloneValue(item, seen)));
        return copy;
    }
    if (Array.isArray(value)) {
        const copy: unknown[] = [];
        seen.set(value, copy);
        value.forEach((item, index) => {
            copy[index] = cloneValue(item, seen);
        });
        return copy;
    }
    const copy: Record<string, unknown> = {};
    seen.set(value, copy);
    for (const key of Object.keys(value)) {
        copy[key] = cloneValue((value as Record<string, unknown>)[key], seen);
    }
    return copy;
};

/**
 * Глубокая копия данных, как у structuredClone: объекты, массивы, Map, Set,
 * даты и типизированные массивы, с циклическими ссылками. Функции не
 * отвергаются, а копируются ссылкой: в программе и ответах сервера их нет
 */
export const structuredClonePolyfill = <T>(value: T): T =>
    cloneValue(value, new Map()) as T;

type Uuid = `${string}-${string}-${string}-${string}-${string}`;

/** UUID версии 4 из crypto.getRandomValues, он есть во всех браузерах с ES-модулями */
export const randomUuidPolyfill = (): Uuid => {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) =>
        byte.toString(16).padStart(2, '0')
    ).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

/** Элемент по индексу с конца при отрицательном индексе, как у Array.prototype.at */
export function atPolyfill(this: ArrayLike<unknown>, index: number): unknown {
    const length = this.length;
    let position = Math.trunc(index) || 0;
    if (position < 0) {
        position += length;
    }
    return position < 0 || position >= length ? undefined : this[position];
}

const defineMissing = (target: object, name: string, value: unknown) => {
    if (typeof (target as Record<string, unknown>)[name] !== 'function') {
        Object.defineProperty(target, name, {
            value,
            writable: true,
            configurable: true,
        });
    }
};

for (const prototype of [
    Array.prototype,
    String.prototype,
    // общий прототип всех типизированных массивов
    Object.getPrototypeOf(Int8Array.prototype),
]) {
    defineMissing(prototype, 'at', atPolyfill);
}

defineMissing(Object, 'hasOwn', (target: object, key: PropertyKey) =>
    Object.prototype.hasOwnProperty.call(target, key)
);

if (typeof globalThis.structuredClone !== 'function') {
    globalThis.structuredClone =
        structuredClonePolyfill as typeof structuredClone;
}

if (typeof crypto !== 'undefined' && typeof crypto.randomUUID !== 'function') {
    crypto.randomUUID = randomUuidPolyfill;
}
