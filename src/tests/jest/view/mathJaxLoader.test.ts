import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import type { MathJax3Config, MathJax3Object } from 'better-react-mathjax';
import { createMathJaxLoader } from '../../../view/utils/mathJaxLoader.ts';

const SRC = '/mathjax/tex-mml-chtml.js';
const RETRY_DELAYS = [1000, 3000, 10000];
const STARTUP_TIMEOUT = 20000;
const RESTART_INTERVAL = 60000;
const REPORT_DELAY = 1500;

type Config = MathJax3Config & {
    loader: { load: string[]; failed: (error: unknown) => void };
    startup: { ready: () => void };
};

type FakeWindow = EventTarget & {
    MathJax?: unknown;
    navigator: { onLine: boolean };
    document: Document;
};

// своё окно на каждый опыт: подписка на online из прошлого опыта сюда не дотянется
let win: FakeWindow;

function setup() {
    win = Object.assign(new EventTarget(), {
        navigator: { onLine: true },
        document,
    });
    const onLoadFailure = jest.fn<(error: Error) => void>();
    const onTypesetError = jest.fn<(error: unknown) => void>();
    const loader = createMathJaxLoader({
        src: SRC,
        createConfig: () => ({
            loader: { load: ['input/asciimath'] },
            tex: { inlineMath: [['$', '$']] },
        }),
        retryDelaysMs: RETRY_DELAYS,
        startupTimeoutMs: STARTUP_TIMEOUT,
        restartIntervalMs: RESTART_INTERVAL,
        reportDelayMs: REPORT_DELAY,
        onLoadFailure,
        onTypesetError,
        window: win as unknown as Window,
    });
    let settled = false;
    loader.ready.then(
        () => (settled = true),
        () => (settled = true)
    );
    return {
        loader,
        onLoadFailure,
        onTypesetError,
        settled: () => settled,
    };
}

const scripts = () =>
    Array.from(document.head.querySelectorAll(`script[src="${SRC}"]`));

/** Тег текущей попытки: он всегда один */
const script = () => {
    expect(scripts()).toHaveLength(1);
    return scripts()[0];
};

const config = () => win.MathJax as Config;

const goOnline = () => {
    win.navigator.onLine = true;
    win.dispatchEvent(new Event('online'));
};

/** Обещания MathJax живут в микрозадачах, таймеры при этом стоят */
const flush = () => jest.advanceTimersByTimeAsync(0);

/** Браузер не скачал скрипт */
const failDownload = () => {
    script().dispatchEvent(new Event('error'));
};

/** Скрипт выполнился: MathJax заменил конфиг собой, но стартует, только когда вызовут ready */
function runScript(
    options: {
        startupError?: Error;
        typeset?: (elements?: unknown[]) => Promise<void>;
    } = {}
) {
    const tag = script();
    const startupConfig = config();
    const mathJax = {
        version: '3.2.2',
        config: startupConfig,
        startup: {
            defaultReady: jest.fn(),
            promise: options.startupError
                ? Promise.reject(options.startupError)
                : Promise.resolve(),
        },
        typesetPromise: jest.fn(options.typeset ?? (() => Promise.resolve())),
        typesetClear: jest.fn<(elements?: unknown[]) => void>(),
    };
    win.MathJax = mathJax;
    tag.dispatchEvent(new Event('load'));
    return { mathJax, ready: () => startupConfig.startup.ready() };
}

/** MathJax скачался и стартовал */
function startMathJax(typeset?: (elements?: unknown[]) => Promise<void>) {
    const run = runScript({ typeset });
    run.ready();
    return run.mathJax;
}

/** Все попытки серии кончаются одинаково */
async function failSeries(failAttempt: () => void | Promise<void>) {
    await failAttempt();
    for (const delay of RETRY_DELAYS) {
        jest.advanceTimersByTime(delay);
        await failAttempt();
    }
}

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    scripts().forEach((tag) => tag.remove());
    jest.useRealTimers();
});

test('a-failed-download-is-retried-without-a-report', async () => {
    const { loader, onLoadFailure } = setup();
    loader.load();
    expect(loader.status()).toBe('loading');
    failDownload();

    expect(scripts()).toHaveLength(0);
    jest.advanceTimersByTime(RETRY_DELAYS[0] - 1);
    expect(scripts()).toHaveLength(0);
    jest.advanceTimersByTime(1);
    // пока идут повторы, формулы ещё ждут MathJax скрытыми
    expect(loader.status()).toBe('loading');
    const mathJax = startMathJax();

    await expect(loader.ready).resolves.toHaveProperty(
        'startup',
        mathJax.startup
    );
    expect(loader.status()).toBe('ready');
    jest.advanceTimersByTime(RESTART_INTERVAL);
    expect(onLoadFailure).not.toHaveBeenCalled();
});

test('the-last-failure-is-reported-once-and-mathjax-never-rejects', async () => {
    const { loader, onLoadFailure, settled } = setup();
    loader.load();
    await failSeries(failDownload);

    expect(loader.status()).toBe('failed');
    // отчёт ждёт: страница, которая в этот момент уходит, его не пошлёт
    expect(onLoadFailure).not.toHaveBeenCalled();
    jest.advanceTimersByTime(REPORT_DELAY);
    expect(onLoadFailure).toHaveBeenCalledTimes(1);
    await flush();
    expect(settled()).toBe(false);

    // новый ответ с формулой сразу после отказа MathJax заново не качает
    loader.load();
    expect(scripts()).toHaveLength(0);
    // и вернувшаяся сеть тоже ждёт минуту с отказа
    goOnline();
    jest.advanceTimersByTime(RESTART_INTERVAL - REPORT_DELAY - 1);
    expect(scripts()).toHaveLength(0);
    jest.advanceTimersByTime(1);
    script();
    // формулы уже показаны текстом и на время новой серии не прячутся
    expect(loader.status()).toBe('failed');

    await failSeries(failDownload);
    jest.advanceTimersByTime(REPORT_DELAY);
    expect(onLoadFailure).toHaveBeenCalledTimes(1);

    // через минуту новый ответ с формулой пробует снова, и MathJax приходит без перезагрузки
    jest.advanceTimersByTime(RESTART_INTERVAL);
    loader.load();
    startMathJax();
    await flush();
    expect(settled()).toBe(true);
    expect(loader.status()).toBe('ready');
});

test.each<[string, () => void | Promise<void>]>([
    ['download', failDownload],
    // ответ 200, но вместо MathJax пришла, например, страница-заглушка
    [
        'not-mathjax',
        () => {
            script().dispatchEvent(new Event('load'));
        },
    ],
    [
        `startup (Can't load "/mathjax/input/asciimath.js")`,
        () =>
            config().loader.failed(
                new Error(`Can't load "/mathjax/input/asciimath.js"`)
            ),
    ],
    [
        'startup (Typesetting failed)',
        async () => {
            runScript({
                startupError: new Error('Typesetting failed'),
            }).ready();
            await flush();
        },
    ],
    // скрипт выполнился, а до ready дело не дошло
    [
        'startup-timeout',
        () => {
            runScript();
            jest.advanceTimersByTime(STARTUP_TIMEOUT);
        },
    ],
])('the-report-names-the-last-failure-%s', async (failure, failAttempt) => {
    const { loader, onLoadFailure } = setup();
    loader.load();
    await failSeries(async () => {
        await failAttempt();
        // неудачная попытка убирает за собой тег и недостартовавший MathJax
        expect(scripts()).toHaveLength(0);
        expect(win.MathJax).toBeUndefined();
    });
    jest.advanceTimersByTime(REPORT_DELAY);

    expect(onLoadFailure).toHaveBeenCalledTimes(1);
    expect(onLoadFailure.mock.calls[0][0].message).toBe(
        `MathJax gave up after 4 attempts, last failure: ${failure}`
    );
});

test('the-watchdog-waits-for-startup-but-not-for-the-download', async () => {
    const { loader } = setup();
    loader.load();
    // медленная сеть качает 1,17 МБ долго, и повтор её не ускорит
    jest.advanceTimersByTime(STARTUP_TIMEOUT * 3);
    script();

    const run = runScript();
    jest.advanceTimersByTime(STARTUP_TIMEOUT - 1);
    run.ready();
    jest.advanceTimersByTime(STARTUP_TIMEOUT * 3);

    await expect(loader.ready).resolves.toBeDefined();
    expect(loader.status()).toBe('ready');
    script();
});

test('a-startup-that-began-before-load-is-not-cut-by-the-watchdog', async () => {
    const { loader } = setup();
    loader.load();
    // догружать нечего: ready приходит в микрозадаче раньше load тега, а набор страницы ещё идёт
    let typeset: () => void = () => undefined;
    const startupConfig = config();
    win.MathJax = {
        version: '3.2.2',
        startup: {
            defaultReady: jest.fn(),
            promise: new Promise<void>((resolve) => (typeset = resolve)),
        },
    };
    startupConfig.startup.ready();
    script().dispatchEvent(new Event('load'));
    jest.advanceTimersByTime(STARTUP_TIMEOUT * 3);
    typeset();

    await expect(loader.ready).resolves.toBeDefined();
    script();
});

test('offline-failure-waits-for-the-network-and-spends-no-retries', async () => {
    const { loader, onLoadFailure } = setup();
    loader.load();
    win.navigator.onLine = false;
    failDownload();

    expect(loader.status()).toBe('waiting-online');
    expect(jest.getTimerCount()).toBe(0);
    // новые формулы без сети тоже ничего не качают
    loader.load();
    expect(scripts()).toHaveLength(0);

    goOnline();
    script();
    // формулы уже показаны текстом и на время попытки не прячутся
    expect(loader.status()).toBe('waiting-online');
    // попытка без сети не потрачена: впереди все четыре
    await failSeries(() => {
        failDownload();
        // сеть есть, а MathJax не пришёл: это уже отказ, а не ожидание сети
        expect(loader.status()).toBe('failed');
    });
    jest.advanceTimersByTime(REPORT_DELAY);
    expect(onLoadFailure).toHaveBeenCalledTimes(1);
});

test('each-attempt-starts-mathjax-from-a-fresh-config', async () => {
    const { loader } = setup();
    loader.load();
    const first = config();
    // MathJax дописывает в конфиг своё
    first.loader.load.push('mutated-by-mathjax');
    first.loader.failed(new Error(`Can't load "/mathjax/input/asciimath.js"`));

    expect(win.MathJax).toBeUndefined();
    jest.advanceTimersByTime(RETRY_DELAYS[0]);
    expect(config()).not.toBe(first);
    expect(config().loader.load).toEqual(['input/asciimath']);
    // брошенная попытка проснулась поздно и новой не мешает
    first.startup.ready();
    const mathJax = startMathJax();

    await expect(loader.ready).resolves.toHaveProperty(
        'startup',
        mathJax.startup
    );
});

test('many-contexts-on-a-page-load-mathjax-once', async () => {
    const { loader } = setup();
    loader.load();
    loader.load();
    script();
    failDownload();
    // повтор ждёт своего таймера, новый контекст его не торопит
    loader.load();
    expect(scripts()).toHaveLength(0);
    jest.advanceTimersByTime(RETRY_DELAYS[0]);
    loader.load();
    startMathJax();
    await loader.ready;
    loader.load();

    script();
});

test('typeset-errors-are-caught-and-reported-once-a-bit-later', async () => {
    const { loader, onTypesetError } = setup();
    loader.load();
    const error = new Error(
        `Can't load "/mathjax/input/tex/extensions/color.js"`
    );
    startMathJax(() => Promise.reject(error));
    const mathJax: MathJax3Object = await loader.ready;

    await expect(mathJax.typesetPromise([])).resolves.toBeUndefined();
    await expect(mathJax.typesetPromise([])).resolves.toBeUndefined();
    expect(onTypesetError).not.toHaveBeenCalled();
    jest.advanceTimersByTime(REPORT_DELAY);
    expect(onTypesetError).toHaveBeenCalledTimes(1);
    expect(onTypesetError).toHaveBeenCalledWith(error);

    await mathJax.typesetPromise([]);
    jest.advanceTimersByTime(REPORT_DELAY);
    expect(onTypesetError).toHaveBeenCalledTimes(1);
});

// в WebKit pagehide приходит через десятки миллисекунд после ошибок оборванных загрузок
const LEAVE_GAP = 100;

test.each(['pagehide', 'beforeunload'])(
    'nothing-is-reported-when-%s-follows-the-error',
    async (leave) => {
        const { loader, onLoadFailure, onTypesetError } = setup();
        loader.load();
        await failSeries(failDownload);
        jest.advanceTimersByTime(LEAVE_GAP);
        win.dispatchEvent(new Event(leave));
        jest.advanceTimersByTime(REPORT_DELAY);
        expect(onLoadFailure).not.toHaveBeenCalled();

        jest.advanceTimersByTime(RESTART_INTERVAL);
        loader.load();
        startMathJax(() => Promise.reject(new Error('extension')));
        const mathJax: MathJax3Object = await loader.ready;
        await mathJax.typesetPromise([]);
        jest.advanceTimersByTime(LEAVE_GAP);
        win.dispatchEvent(new Event(leave));
        jest.advanceTimersByTime(REPORT_DELAY);
        expect(onTypesetError).not.toHaveBeenCalled();
    }
);

test('a-page-back-from-bfcache-reports-a-new-error', async () => {
    const { loader, onTypesetError } = setup();
    loader.load();
    const error = new Error('extension');
    startMathJax(() => Promise.reject(error));
    const mathJax: MathJax3Object = await loader.ready;
    await mathJax.typesetPromise([]);
    win.dispatchEvent(new Event('pagehide'));
    jest.advanceTimersByTime(REPORT_DELAY);
    expect(onTypesetError).not.toHaveBeenCalled();

    // страница вернулась из bfcache, и новая ошибка уже не связана с уходом
    win.dispatchEvent(new Event('pageshow'));
    await mathJax.typesetPromise([]);
    jest.advanceTimersByTime(REPORT_DELAY);
    expect(onTypesetError).toHaveBeenCalledTimes(1);
    expect(onTypesetError).toHaveBeenCalledWith(error);
});

test('the-facade-is-mathjax-that-typesets-the-given-elements', async () => {
    const { loader } = setup();
    loader.load();
    const mathJax = startMathJax();
    const facade: MathJax3Object = await loader.ready;
    const elements = [document.createElement('span')];

    await facade.typesetPromise(elements);
    facade.typesetClear(elements);

    // без элементов MathJax набирал бы на каждую формулу всю страницу
    expect(mathJax.typesetPromise).toHaveBeenCalledWith(elements);
    expect(mathJax.typesetClear).toHaveBeenCalledWith(elements);
    expect(facade.startup).toBe(mathJax.startup);
});
