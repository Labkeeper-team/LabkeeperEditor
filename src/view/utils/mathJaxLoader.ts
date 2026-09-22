import type { MathJax3Config, MathJax3Object } from 'better-react-mathjax';

/** loading бывает только в первой серии попыток: после отказа формулы уже видны текстом и на время новых попыток не прячутся */
export type MathJaxStatus =
    'idle' | 'loading' | 'ready' | 'waiting-online' | 'failed';

/** Чем кончилась неудачная попытка: отчёт отличает обрыв скачивания от отказа старта */
export type MathJaxFailure =
    'download' | 'not-mathjax' | 'startup' | 'startup-timeout';

export interface MathJaxLoaderOptions {
    src: string;
    /** На каждую попытку свежий конфиг: MathJax дописывает в него своё */
    createConfig: () => MathJax3Config;
    /** Паузы перед повторами, после последней попытки серия кончается отказом */
    retryDelaysMs: readonly number[];
    /** Сколько ждать startup.ready после того, как скрипт выполнился */
    startupTimeoutMs: number;
    /** Новая серия после отказа не чаще этого, иначе каждый ответ с формулой качал бы MathJax заново */
    restartIntervalMs: number;
    /** Отчёт ждёт столько и не уходит, если страница за это время закрылась */
    reportDelayMs: number;
    onLoadFailure: (error: Error) => void;
    onTypesetError: (error: unknown) => void;
    /** В тестах своё окно, чтобы подписки на online не тянулись между опытами */
    window?: Window;
}

export interface MathJaxLoader {
    /** MathJax на всю страницу, обещание никогда не отклоняется */
    readonly ready: Promise<MathJax3Object>;
    /** Запускает загрузку, если она не идёт, ещё не удалась и отказ был не слишком давно */
    load(): void;
    status(): MathJaxStatus;
    subscribe(listener: () => void): () => void;
}

type MathJaxGlobal = { MathJax?: MathJax3Config | MathJax3Object };

const messageOf = (error: unknown) =>
    error instanceof Error ? error.message : String(error);

/** Отчёт один на страницу и ждёт: уходя со страницы, WebKit и Firefox обрывают загрузки с ошибкой ещё до pagehide */
function createPageReport<T>(
    win: Window,
    delayMs: number,
    send: (value: T) => void
) {
    let state: 'none' | 'pending' | 'sent' = 'none';
    return (value: T) => {
        if (state !== 'none') {
            return;
        }
        state = 'pending';
        let leaving = false;
        const onLeave = () => {
            leaving = true;
        };
        // слушаем только на время ожидания: постоянный beforeunload в Firefox выключает bfcache
        win.addEventListener('pagehide', onLeave);
        win.addEventListener('beforeunload', onLeave);
        setTimeout(() => {
            win.removeEventListener('pagehide', onLeave);
            win.removeEventListener('beforeunload', onLeave);
            if (leaving) {
                state = 'none';
                return;
            }
            state = 'sent';
            send(value);
        }, delayMs);
    };
}

// better-react-mathjax бросает ошибку набора из catch необработанной, поэтому компонентам отдаём MathJax, чей набор не отклоняется
function withSafeTypeset(
    mathJax: MathJax3Object,
    onError: (error: unknown) => void
): MathJax3Object {
    return Object.create(mathJax, {
        typesetPromise: {
            value: (elements?: HTMLElement[]) =>
                mathJax.typesetPromise(elements).catch(onError),
        },
    });
}

export function createMathJaxLoader(
    options: MathJaxLoaderOptions
): MathJaxLoader {
    const win = options.window ?? window;
    const global = win as unknown as MathJaxGlobal;
    const attempts = options.retryDelaysMs.length + 1;
    let status: MathJaxStatus = 'idle';
    // серия идёт: попытка в полёте, ждёт таймера повтора или сети
    let running = false;
    let failures = 0;
    let gaveUpAt: number | undefined;
    let restartTimer: ReturnType<typeof setTimeout> | undefined;
    let resolveReady: (mathJax: MathJax3Object) => void = () => undefined;
    const ready = new Promise<MathJax3Object>((resolve) => {
        resolveReady = resolve;
    });
    const listeners = new Set<() => void>();
    const reportLoadFailure = createPageReport(
        win,
        options.reportDelayMs,
        options.onLoadFailure
    );
    const reportTypesetError = createPageReport(
        win,
        options.reportDelayMs,
        options.onTypesetError
    );

    const setStatus = (next: MathJaxStatus) => {
        if (status === next) {
            return;
        }
        status = next;
        listeners.forEach((listener) => listener());
    };

    const canStart = () => status !== 'ready' && !running;

    const startSeries = () => {
        running = true;
        failures = 0;
        attempt();
    };

    const resumeOnline = () => attempt();

    function restartWhenOnline() {
        if (!canStart() || restartTimer !== undefined) {
            return;
        }
        const wait = (gaveUpAt ?? 0) + options.restartIntervalMs - Date.now();
        if (wait <= 0) {
            startSeries();
            return;
        }
        restartTimer = setTimeout(() => {
            restartTimer = undefined;
            if (canStart()) {
                startSeries();
            }
        }, wait);
    }

    function giveUp(failure: MathJaxFailure, detail?: string) {
        running = false;
        gaveUpAt = Date.now();
        setStatus('failed');
        reportLoadFailure(
            new Error(
                `MathJax gave up after ${attempts} attempts, last failure: ${failure}${detail ? ` (${detail})` : ''}`
            )
        );
        win.addEventListener('online', restartWhenOnline, { once: true });
    }

    function onAttemptFailed(failure: MathJaxFailure, detail?: string) {
        // без сети попытки не тратим, ждём её возвращения
        if (win.navigator.onLine === false) {
            setStatus('waiting-online');
            win.addEventListener('online', resumeOnline, { once: true });
            return;
        }
        if (status === 'waiting-online') {
            setStatus('failed');
        }
        failures += 1;
        const delay = options.retryDelaysMs[failures - 1];
        if (delay === undefined) {
            giveUp(failure, detail);
            return;
        }
        // при уходе со страницы документ умирает раньше таймера, и отчёта не будет
        setTimeout(attempt, delay);
    }

    function attempt() {
        if (status === 'idle') {
            setStatus('loading');
        }
        let settled = false;
        let started = false;
        let startupTimer: ReturnType<typeof setTimeout> | undefined;
        const script = win.document.createElement('script');
        const settle = () => {
            if (settled) {
                return false;
            }
            settled = true;
            clearTimeout(startupTimer);
            return true;
        };
        const fail = (failure: MathJaxFailure, detail?: string) => {
            if (!settle()) {
                return;
            }
            script.remove();
            // иначе следующий скрипт примет прошлый недостартовавший MathJax за готовый
            delete global.MathJax;
            onAttemptFailed(failure, detail);
        };
        const config = options.createConfig();
        config.loader = {
            ...config.loader,
            failed: (error: unknown) => fail('startup', messageOf(error)),
        };
        config.startup = {
            ...config.startup,
            ready: () => {
                // старая попытка может проснуться, когда глобальный MathJax уже от новой
                if (settled) {
                    return;
                }
                started = true;
                clearTimeout(startupTimer);
                const mathJax = global.MathJax as MathJax3Object;
                mathJax.startup.defaultReady();
                mathJax.startup.promise.then(
                    () => {
                        if (!settle()) {
                            return;
                        }
                        setStatus('ready');
                        win.removeEventListener('online', restartWhenOnline);
                        resolveReady(
                            withSafeTypeset(mathJax, reportTypesetError)
                        );
                    },
                    (error: unknown) => fail('startup', messageOf(error))
                );
            },
        };
        global.MathJax = config;
        script.src = options.src;
        script.async = true;
        script.addEventListener('error', () => fail('download'));
        script.addEventListener('load', () => {
            // ready мог прийти раньше load, если догружать было нечего
            if (settled || started) {
                return;
            }
            // ответ 200, но это не MathJax, например страница-заглушка вместо файла
            if (!(global.MathJax as MathJax3Object | undefined)?.version) {
                fail('not-mathjax');
                return;
            }
            // таймер только на старт: скачивание на медленной сети долгое, и повтор его не ускорит
            startupTimer = setTimeout(
                () => fail('startup-timeout'),
                options.startupTimeoutMs
            );
        });
        win.document.head.appendChild(script);
    }

    return {
        ready,
        load() {
            if (!canStart()) {
                return;
            }
            if (
                gaveUpAt !== undefined &&
                Date.now() - gaveUpAt < options.restartIntervalMs
            ) {
                return;
            }
            startSeries();
        },
        status: () => status,
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
}
