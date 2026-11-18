/**
 * Page-wide loader for the Yandex SmartCaptcha script (captcha.js).
 *
 * We do not use the loader of @yandex/smart-captcha (useSmartCaptchaLoader,
 * which its <SmartCaptcha> calls). It requests captcha.js once per page and
 * marks the host as loading for good, so when that single request fails or
 * hangs no widget on the page ever renders again: the form shows an empty box
 * until the page is reloaded. Only the first widget hears about a failure, and
 * reopening the auth modal does not help. It also cannot simply be mounted
 * after the script is ready: the first <SmartCaptcha> on a page injects its own
 * copy of captcha.js even when window.smartCaptcha already exists. Its list of
 * ready callbacks also removes the wrong entry on unmount (`index = push(...)`,
 * then `splice(index, 1)`), so with two widgets on a page one can lose its own.
 *
 * So the auth forms load the script here and draw the widget through
 * window.smartCaptcha themselves (captchaWidget.tsx).
 */

/** The part of window.smartCaptcha the auth forms use */
export interface SmartCaptchaApi {
    render(
        container: HTMLElement,
        params: { sitekey: string; hl?: string }
    ): number;
    destroy(widgetId?: number): void;
    subscribe(
        widgetId: number,
        event: SmartCaptchaEvent,
        callback: (data?: unknown) => void
    ): (() => void) | undefined;
}

export type SmartCaptchaEvent =
    'success' | 'token-expired' | 'network-error' | 'javascript-error';

/**
 * script: every request for captcha.js failed (ad blocker, VPN, corporate
 * proxy, no network);
 * timeout: the script did not arrive within the page-wide load budget
 */
export type CaptchaScriptFailure = 'script' | 'timeout';

/** error: the browser reported a failed request; stall: no answer in time */
export type CaptchaAttemptOutcome = 'error' | 'stall';

export type CaptchaScriptSnapshot =
    | { status: 'idle' }
    /**
     * overdue: the load budget of this series is spent. Widgets show the
     * timeout error with a retry button, but the attempts in flight go on:
     * if one of them succeeds the captcha still appears
     */
    | { status: 'loading'; overdue: boolean }
    | { status: 'ready'; api: SmartCaptchaApi }
    | { status: 'failed'; failure: CaptchaScriptFailure };

export interface CaptchaScriptFailureDetails {
    /** Requests made in this series, including one that may still be pending */
    attempts: number;
    /** How each finished request ended, in order */
    outcomes: CaptchaAttemptOutcome[];
    elapsedMs: number;
}

export interface CaptchaScriptLoaderOptions {
    /** URL of the first request; later requests add a cache-busting parameter */
    src: string;
    /** How long one request may stay silent (neither load nor error) */
    attemptTimeoutMs: number;
    /** Pauses before the second, third... request; the last failure ends the series */
    retryDelaysMs: readonly number[];
    /** Budget of a whole series, counted from its start and shared by all widgets */
    loadTimeoutMs: number;
    /** Called once per series, when it fails or becomes overdue */
    onFailure?: (
        failure: CaptchaScriptFailure,
        details: CaptchaScriptFailureDetails
    ) => void;
    /** Tests pass their own window so the globals do not leak between them */
    window?: Window;
}

export interface CaptchaScriptLoader {
    /** Starts loading unless it has already started; idempotent, safe on every mount */
    load(): void;
    /** Starts a new series in place after a failure or once the series is overdue */
    retry(): void;
    getSnapshot(): CaptchaScriptSnapshot;
    subscribe(listener: () => void): () => void;
}

/**
 * Global function captcha.js calls once its API is ready. The name and the
 * URL below are exactly what @yandex/smart-captcha 2.9.1 requests, so the
 * script behaves the same as before
 */
const READY_CALLBACK = '__onSmartCaptchaReady';

export const SMART_CAPTCHA_SRC = `https://smartcaptcha.cloud.yandex.ru/captcha.js?render=onload&onload=${READY_CALLBACK}`;

type CaptchaGlobals = {
    smartCaptcha?: Partial<SmartCaptchaApi>;
    [READY_CALLBACK]?: () => void;
};

interface Attempt {
    script: HTMLScriptElement;
    timer?: ReturnType<typeof setTimeout>;
}

export function createCaptchaScriptLoader(
    options: CaptchaScriptLoaderOptions
): CaptchaScriptLoader {
    const win = options.window ?? window;
    const globals = win as unknown as CaptchaGlobals;
    const listeners = new Set<() => void>();
    let snapshot: CaptchaScriptSnapshot = { status: 'idle' };
    // requests made on this page, across series: only the first one may reuse the plain URL
    let requests = 0;
    // requests made in the current series
    let attempts = 0;
    let outcomes: CaptchaAttemptOutcome[] = [];
    let startedAt = 0;
    let failureReported = false;
    let readyCallbackInstalled = false;
    // the request in flight; handlers of any other request are stale and ignored
    let current: Attempt | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let deadlineTimer: ReturnType<typeof setTimeout> | undefined;

    // useSyncExternalStore compares snapshots by reference: a new object only on a real change
    const setSnapshot = (next: CaptchaScriptSnapshot) => {
        snapshot = next;
        listeners.forEach((listener) => listener());
    };

    const readApi = (): SmartCaptchaApi | undefined => {
        const api = globals.smartCaptcha;
        return api &&
            typeof api.render === 'function' &&
            typeof api.destroy === 'function' &&
            typeof api.subscribe === 'function'
            ? (api as SmartCaptchaApi)
            : undefined;
    };

    const clearTimers = () => {
        clearTimeout(retryTimer);
        clearTimeout(deadlineTimer);
        retryTimer = undefined;
        deadlineTimer = undefined;
    };

    /**
     * Forgets the request in flight and removes its tag. A removed script that
     * is still downloading may run later anyway (browsers do not cancel it):
     * then it calls the ready callback, and a late script is welcome
     */
    const abandonCurrent = () => {
        if (!current) {
            return;
        }
        clearTimeout(current.timer);
        current.script.remove();
        current = undefined;
    };

    const report = (failure: CaptchaScriptFailure) => {
        // a series fails once: becoming overdue and then running out of attempts is one failure
        if (failureReported) {
            return;
        }
        failureReported = true;
        options.onFailure?.(failure, {
            attempts,
            outcomes: [...outcomes],
            elapsedMs: Date.now() - startedAt,
        });
    };

    function becomeReady() {
        if (snapshot.status === 'ready') {
            return;
        }
        const api = readApi();
        if (!api) {
            return;
        }
        // The tag that delivered the API stays in the document like any loaded
        // script. If another request is still pending, its late events are
        // ignored; should its script run too, widgets keep this first API
        if (current) {
            clearTimeout(current.timer);
            current = undefined;
        }
        clearTimers();
        setSnapshot({ status: 'ready', api });
    }

    function installReadyCallback() {
        if (readyCallbackInstalled) {
            return;
        }
        readyCallbackInstalled = true;
        // keep a callback someone else has set (for example the loader of a hot-reloaded module)
        const previous = globals[READY_CALLBACK];
        globals[READY_CALLBACK] = () => {
            try {
                previous?.();
            } finally {
                becomeReady();
            }
        };
    }

    // Reports go out before listeners hear the news: a listener that retries
    // at once must not have its new series marked as already reported
    function giveUp(failure: CaptchaScriptFailure) {
        clearTimers();
        report(failure);
        setSnapshot({ status: 'failed', failure });
    }

    function onAttemptFailed(attempt: Attempt, outcome: CaptchaAttemptOutcome) {
        if (attempt !== current) {
            return;
        }
        abandonCurrent();
        outcomes.push(outcome);
        const delay = options.retryDelaysMs[attempts - 1];
        if (delay !== undefined) {
            retryTimer = setTimeout(() => {
                retryTimer = undefined;
                inject();
            }, delay);
            return;
        }
        // Widgets of an overdue series already show and reported the timeout:
        // the reason must not change under them
        const overdue = snapshot.status === 'loading' && snapshot.overdue;
        giveUp(outcome === 'error' && !overdue ? 'script' : 'timeout');
    }

    function onAttemptLoaded(attempt: Attempt) {
        if (attempt !== current) {
            return;
        }
        // captcha.js calls the ready callback itself; this covers a script
        // that exposes window.smartCaptcha without calling back
        becomeReady();
        // If there is no API yet, the attempt timer keeps running: the script
        // may still call back, and if it never does, the request counts as stalled
    }

    function inject() {
        attempts += 1;
        requests += 1;
        const script = win.document.createElement('script');
        // The first request is the library's exact URL, so the HTTP cache can
        // serve it. Every later one gets its own URL: Chrome makes a request
        // wait while another request for the same URL is in flight (cache
        // lock), so retrying a hung URL would hang behind it
        const separator = options.src.includes('?') ? '&' : '?';
        script.src =
            requests === 1
                ? options.src
                : `${options.src}${separator}_=${requests}.${Date.now()}`;
        // Same as the library: with CORS, errors inside captcha.js keep their
        // message and file instead of becoming a bare "Script error."
        script.type = 'text/javascript';
        script.crossOrigin = 'anonymous';
        const attempt: Attempt = { script };
        attempt.timer = setTimeout(
            () => onAttemptFailed(attempt, 'stall'),
            options.attemptTimeoutMs
        );
        script.addEventListener('error', () =>
            onAttemptFailed(attempt, 'error')
        );
        script.addEventListener('load', () => onAttemptLoaded(attempt));
        current = attempt;
        win.document.body.appendChild(script);
    }

    function onDeadline() {
        deadlineTimer = undefined;
        if (snapshot.status !== 'loading') {
            return;
        }
        report('timeout');
        setSnapshot({ status: 'loading', overdue: true });
    }

    function startSeries() {
        abandonCurrent();
        clearTimers();
        attempts = 0;
        outcomes = [];
        failureReported = false;
        startedAt = Date.now();
        installReadyCallback();
        // the script is already on the page, for example an abandoned request has run meanwhile
        if (readApi()) {
            becomeReady();
            return;
        }
        setSnapshot({ status: 'loading', overdue: false });
        // One deadline per series, not per widget: the auth modal unmounts its
        // forms when closed, and a timer per mount restarted on every reopen,
        // so a hung script never got reported to the person waiting for it
        deadlineTimer = setTimeout(onDeadline, options.loadTimeoutMs);
        inject();
    }

    return {
        load() {
            if (snapshot.status === 'idle') {
                startSeries();
            }
        },
        retry() {
            if (
                snapshot.status === 'failed' ||
                (snapshot.status === 'loading' && snapshot.overdue)
            ) {
                startSeries();
            }
        },
        getSnapshot: () => snapshot,
        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
}
