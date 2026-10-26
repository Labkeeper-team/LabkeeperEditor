import {
    atPolyfill,
    randomUuidPolyfill,
    structuredClonePolyfill,
} from '../../../web/legacyBrowserPolyfills.ts';

// свежая копия модуля: подмены ставятся при его загрузке
const loadFreshPolyfills = () =>
    jest.isolateModulesAsync(async () => {
        await import('../../../web/legacyBrowserPolyfills.ts');
    });

// В Bugsink приходили Chrome 86 и 95: без structuredClone редактор не открывал проект
test('structuredClone is filled in where the browser has none', async () => {
    const native = globalThis.structuredClone;
    // @ts-expect-error старый браузер
    delete globalThis.structuredClone;
    try {
        await loadFreshPolyfills();
        // свой экземпляр модуля: сверяем по имени и по делу
        expect(globalThis.structuredClone.name).toBe(
            structuredClonePolyfill.name
        );
        expect(globalThis.structuredClone({ a: [1] })).toEqual({ a: [1] });
    } finally {
        globalThis.structuredClone = native;
    }
});

test('crypto.randomUUID is filled in where the browser has none', async () => {
    const native = crypto.randomUUID;
    // @ts-expect-error старый браузер
    delete crypto.randomUUID;
    Object.defineProperty(crypto, 'randomUUID', {
        value: undefined,
        configurable: true,
        writable: true,
    });
    try {
        await loadFreshPolyfills();
        expect(crypto.randomUUID.name).toBe(randomUuidPolyfill.name);
        expect(crypto.randomUUID()).toMatch(/^[0-9a-f-]{36}$/);
    } finally {
        Object.defineProperty(crypto, 'randomUUID', {
            value: native,
            configurable: true,
            writable: true,
        });
    }
});

test('.at() is filled in where the browser has none', async () => {
    const arrayPrototype = Array.prototype as unknown as Record<
        string,
        unknown
    >;
    const native = arrayPrototype.at;
    delete arrayPrototype.at;
    try {
        await loadFreshPolyfills();
        const list = [1, 2, 3] as unknown as { at: (index: number) => number };
        expect(list.at(-1)).toBe(3);
    } finally {
        Object.defineProperty(Array.prototype, 'at', {
            value: native,
            configurable: true,
            writable: true,
        });
    }
});

test('the native structuredClone is kept', async () => {
    const native = globalThis.structuredClone;
    await loadFreshPolyfills();
    expect(globalThis.structuredClone).toBe(native);
});

test('the clone is deep and independent of the source', () => {
    const date = new Date(0);
    const source = {
        segments: [{ id: 1, text: 'a', parameters: { visible: true } }],
        at: date,
        tags: new Set(['x']),
        map: new Map([['k', { n: 1 }]]),
        bytes: new Uint8Array([1, 2]),
        empty: null,
        missing: undefined,
    };

    const copy = structuredClonePolyfill(source);
    source.segments[0].parameters.visible = false;
    source.map.get('k')!.n = 2;
    source.bytes[0] = 9;

    expect(copy).toEqual({
        segments: [{ id: 1, text: 'a', parameters: { visible: true } }],
        at: new Date(0),
        tags: new Set(['x']),
        map: new Map([['k', { n: 1 }]]),
        bytes: new Uint8Array([1, 2]),
        empty: null,
        missing: undefined,
    });
    expect(copy.at).not.toBe(date);
});

test('the clone keeps cyclic references', () => {
    const node: { name: string; self?: unknown } = { name: 'root' };
    node.self = node;

    const copy = structuredClonePolyfill(node);

    expect(copy).not.toBe(node);
    expect(copy.self).toBe(copy);
});

test('randomUUID gives a version 4 UUID', () => {
    const ids = new Set(Array.from({ length: 50 }, randomUuidPolyfill));

    expect(ids.size).toBe(50);
    for (const id of ids) {
        expect(id).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
        );
    }
});

test('at counts negative indexes from the end', () => {
    const at = (list: ArrayLike<unknown>, index: number) =>
        atPolyfill.call(list, index);

    expect(at([1, 2, 3], -1)).toBe(3);
    expect(at([1, 2, 3], 0)).toBe(1);
    expect(at([1, 2, 3], 3)).toBeUndefined();
    expect(at([1, 2, 3], -4)).toBeUndefined();
    expect(at('a+b', -1)).toBe('b');
});
