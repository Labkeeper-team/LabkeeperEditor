import {
    isChunkLoadError,
    reloadOnChunkError,
} from '../../../view/routing/reloadOnChunkError.ts';

// Bugsink: YaBrowser на iOS не догрузил чанк страницы проекта, и вместо редактора была страница ошибки
const SAFARI = new TypeError('Importing a module script failed.');

beforeEach(() => {
    sessionStorage.clear();
    jest.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

test.each([
    'Importing a module script failed.',
    'Failed to fetch dynamically imported module: https://labkeeper.io/assets/project-x.js',
    'error loading dynamically imported module: https://labkeeper.io/assets/project-x.js',
    'Unable to preload CSS for /assets/project-x.css',
])('a failed chunk is recognised: %s', (message) => {
    expect(isChunkLoadError(new TypeError(message))).toBe(true);
});

test('an error of the page code is not a failed chunk', () => {
    expect(isChunkLoadError(new TypeError('x is undefined'))).toBe(false);
});

test('a failed chunk reloads the page once', async () => {
    const reload = jest.fn();

    void reloadOnChunkError(() => Promise.reject(SAFARI), reload);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(reload).toHaveBeenCalledTimes(1);
});

// если и после перезагрузки чанк не пришёл, петли нет: ошибку видит граница ошибок
test('the second failure right after the reload goes to the error boundary', async () => {
    const reload = jest.fn();
    void reloadOnChunkError(() => Promise.reject(SAFARI), reload);
    await new Promise((resolve) => setTimeout(resolve, 0));

    await expect(
        reloadOnChunkError(() => Promise.reject(SAFARI), reload)
    ).rejects.toBe(SAFARI);
    expect(reload).toHaveBeenCalledTimes(1);
});

test('a failure a minute after the reload reloads again', async () => {
    const reload = jest.fn();
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    void reloadOnChunkError(() => Promise.reject(SAFARI), reload);
    await new Promise((resolve) => setTimeout(resolve, 0));

    now.mockReturnValue(1_000_000 + 61_000);
    void reloadOnChunkError(() => Promise.reject(SAFARI), reload);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(reload).toHaveBeenCalledTimes(2);
});

test('an error of the page code is not hidden by a reload', async () => {
    const reload = jest.fn();
    const error = new TypeError('x is undefined');

    await expect(
        reloadOnChunkError(() => Promise.reject(error), reload)
    ).rejects.toBe(error);
    expect(reload).not.toHaveBeenCalled();
});

test('a loaded chunk is returned as it is', async () => {
    const module = { default: 'page' };

    await expect(
        reloadOnChunkError(() => Promise.resolve(module), jest.fn())
    ).resolves.toBe(module);
});
