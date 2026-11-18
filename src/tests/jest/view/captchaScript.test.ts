import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import {
    type CaptchaScriptFailure,
    type CaptchaScriptFailureDetails,
    createCaptchaScriptLoader,
    SMART_CAPTCHA_SRC,
    type SmartCaptchaApi,
} from '../../../view/pages/project/auth/captchaScript.ts';

// The loader of @yandex/smart-captcha requested captcha.js once per page: a
// failed or hung request left every captcha on the page empty until a reload.
// The browser is played by hand here: a tag is "answered" by its events, and
// the script "runs" by putting window.smartCaptcha in place and calling back

const ATTEMPT_TIMEOUT = 5_000;
const RETRY_DELAYS = [1_000, 3_000];
const LOAD_TIMEOUT = 15_000;

type FakeWindow = {
    document: Document;
    smartCaptcha?: unknown;
    __onSmartCaptchaReady?: () => void;
};

// a window per test: the globals captcha.js uses must not leak between tests
let win: FakeWindow;

const API: SmartCaptchaApi = {
    render: () => 1,
    destroy: () => undefined,
    subscribe: () => () => undefined,
};

beforeEach(() => {
    jest.useFakeTimers();
    win = { document };
});

afterEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = '';
});

function setup() {
    const onFailure =
        jest.fn<
            (
                failure: CaptchaScriptFailure,
                details: CaptchaScriptFailureDetails
            ) => void
        >();
    const loader = createCaptchaScriptLoader({
        src: SMART_CAPTCHA_SRC,
        attemptTimeoutMs: ATTEMPT_TIMEOUT,
        retryDelaysMs: RETRY_DELAYS,
        loadTimeoutMs: LOAD_TIMEOUT,
        onFailure,
        window: win as unknown as Window,
    });
    const changes = jest.fn();
    loader.subscribe(changes);
    return { loader, onFailure, changes };
}

const scripts = () =>
    Array.from(document.body.querySelectorAll<HTMLScriptElement>('script'));

/** Tag of the request in flight: there is never more than one in the document */
const script = () => {
    expect(scripts()).toHaveLength(1);
    return scripts()[0];
};

/** captcha.js arrived: the API is in place, the script calls back, then its tag fires load */
function runScript(tag: HTMLScriptElement) {
    win.smartCaptcha = API;
    win.__onSmartCaptchaReady?.();
    tag.dispatchEvent(new Event('load'));
}

/** The browser could not fetch the script: blocker, VPN, dropped connection */
const failRequest = (tag: HTMLScriptElement) =>
    tag.dispatchEvent(new Event('error'));

test('the-first-request-is-the-library-url-and-its-script-makes-the-loader-ready', () => {
    const { loader, onFailure, changes } = setup();
    expect(loader.getSnapshot()).toEqual({ status: 'idle' });

    loader.load();

    expect(loader.getSnapshot()).toEqual({ status: 'loading', overdue: false });
    const tag = script();
    // byte for byte what @yandex/smart-captcha requested, so the HTTP cache keeps working
    expect(tag.src).toBe(
        'https://smartcaptcha.cloud.yandex.ru/captcha.js?render=onload&onload=__onSmartCaptchaReady'
    );
    expect(tag.crossOrigin).toBe('anonymous');
    expect(tag.type).toBe('text/javascript');

    runScript(tag);

    expect(loader.getSnapshot()).toEqual({ status: 'ready', api: API });
    expect(changes).toHaveBeenCalledTimes(2);
    // the deadline of the series is gone with it
    jest.advanceTimersByTime(LOAD_TIMEOUT * 2);
    expect(loader.getSnapshot().status).toBe('ready');
    expect(onFailure).not.toHaveBeenCalled();
});

test('every-form-joins-the-one-request-of-the-page', () => {
    const { loader } = setup();

    loader.load();
    const snapshot = loader.getSnapshot();
    loader.load();
    loader.load();

    expect(scripts()).toHaveLength(1);
    // useSyncExternalStore needs the same object while nothing changes
    expect(loader.getSnapshot()).toBe(snapshot);

    runScript(script());
    loader.load();
    expect(scripts()).toHaveLength(1);
});

test('a-script-already-on-the-page-needs-no-request', () => {
    win.smartCaptcha = API;
    const { loader } = setup();

    loader.load();

    expect(loader.getSnapshot()).toEqual({ status: 'ready', api: API });
    expect(scripts()).toHaveLength(0);
});

test('a-failed-request-is-retried-with-its-own-url-after-a-pause', () => {
    const { loader, onFailure } = setup();
    loader.load();
    const first = script();

    failRequest(first);

    // the failed tag goes away at once, the next request waits for the pause
    expect(scripts()).toHaveLength(0);
    expect(loader.getSnapshot()).toEqual({ status: 'loading', overdue: false });
    jest.advanceTimersByTime(RETRY_DELAYS[0] - 1);
    expect(scripts()).toHaveLength(0);
    jest.advanceTimersByTime(1);
    const second = script();
    // a fresh URL: a retry of the same URL can wait behind a request still in flight
    expect(second.src.startsWith(`${SMART_CAPTCHA_SRC}&_=`)).toBe(true);

    runScript(second);

    expect(loader.getSnapshot()).toEqual({ status: 'ready', api: API });
    expect(onFailure).not.toHaveBeenCalled();
});

test('a-request-that-never-answers-is-abandoned-and-made-again', () => {
    const { loader, onFailure } = setup();
    loader.load();
    const first = script();

    jest.advanceTimersByTime(ATTEMPT_TIMEOUT - 1);
    expect(script()).toBe(first);
    jest.advanceTimersByTime(1);
    expect(scripts()).toHaveLength(0);
    jest.advanceTimersByTime(RETRY_DELAYS[0]);
    const second = script();
    expect(second.src).not.toBe(first.src);

    runScript(second);

    expect(loader.getSnapshot()).toEqual({ status: 'ready', api: API });
    expect(onFailure).not.toHaveBeenCalled();
});

test('a-blocked-script-gives-up-after-three-requests-and-reports-once', () => {
    const { loader, onFailure } = setup();
    loader.load();
    const urls: string[] = [];
    const failCurrent = () => {
        const tag = script();
        urls.push(tag.src);
        failRequest(tag);
    };

    failCurrent();
    jest.advanceTimersByTime(RETRY_DELAYS[0]);
    failCurrent();
    jest.advanceTimersByTime(RETRY_DELAYS[1]);
    failCurrent();

    expect(loader.getSnapshot()).toEqual({
        status: 'failed',
        failure: 'script',
    });
    expect(new Set(urls).size).toBe(3);
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith('script', {
        attempts: 3,
        outcomes: ['error', 'error', 'error'],
        elapsedMs: RETRY_DELAYS[0] + RETRY_DELAYS[1],
    });
    // no more requests and no second report until somebody presses retry
    jest.advanceTimersByTime(LOAD_TIMEOUT * 2);
    expect(scripts()).toHaveLength(0);
    expect(onFailure).toHaveBeenCalledTimes(1);
});

test('a-hung-network-is-overdue-after-the-budget-while-the-last-request-goes-on', () => {
    const { loader, onFailure } = setup();
    loader.load();

    // 0 s first request, 5 s silent; 6 s second, 11 s silent; 14 s third
    jest.advanceTimersByTime(
        ATTEMPT_TIMEOUT + RETRY_DELAYS[0] + ATTEMPT_TIMEOUT + RETRY_DELAYS[1]
    );
    const third = script();
    expect(loader.getSnapshot()).toEqual({ status: 'loading', overdue: false });

    jest.advanceTimersByTime(LOAD_TIMEOUT - 14_000);

    expect(loader.getSnapshot()).toEqual({ status: 'loading', overdue: true });
    expect(onFailure).toHaveBeenCalledWith('timeout', {
        attempts: 3,
        outcomes: ['stall', 'stall'],
        elapsedMs: LOAD_TIMEOUT,
    });
    // forms show the timeout, but the third request may still bring the captcha
    expect(script()).toBe(third);
    runScript(third);
    expect(loader.getSnapshot()).toEqual({ status: 'ready', api: API });
    expect(onFailure).toHaveBeenCalledTimes(1);
});

test('an-overdue-series-that-runs-out-of-requests-keeps-its-timeout', () => {
    const { loader, onFailure } = setup();
    loader.load();
    jest.advanceTimersByTime(
        ATTEMPT_TIMEOUT + RETRY_DELAYS[0] + ATTEMPT_TIMEOUT + RETRY_DELAYS[1]
    );
    jest.advanceTimersByTime(LOAD_TIMEOUT - 14_000);

    // the third request fails outright after the forms already showed the timeout
    failRequest(script());

    expect(loader.getSnapshot()).toEqual({
        status: 'failed',
        failure: 'timeout',
    });
    expect(onFailure).toHaveBeenCalledTimes(1);
});

test('the-deadline-runs-from-the-first-form-not-from-each-mount', () => {
    const { loader, onFailure } = setup();
    // the login form opens and asks for the script
    loader.load();
    jest.advanceTimersByTime(10_000);
    // the modal is closed and opened again: a new form asks for it again
    loader.load();
    expect(loader.getSnapshot()).toEqual({ status: 'loading', overdue: false });

    jest.advanceTimersByTime(LOAD_TIMEOUT - 10_000);

    // 15 s after the first form, not after the last one
    expect(loader.getSnapshot()).toEqual({ status: 'loading', overdue: true });
    expect(onFailure).toHaveBeenCalledTimes(1);
    // a form mounted later learns it from the snapshot right away, without a timer of its own
    const lateForm = jest.fn();
    loader.subscribe(lateForm);
    loader.load();
    expect(loader.getSnapshot()).toEqual({ status: 'loading', overdue: true });
    expect(lateForm).not.toHaveBeenCalled();
});

test('retry-after-a-failure-starts-a-new-series-in-place', () => {
    const { loader, onFailure } = setup();
    loader.load();
    failRequest(script());
    jest.advanceTimersByTime(RETRY_DELAYS[0]);
    failRequest(script());
    jest.advanceTimersByTime(RETRY_DELAYS[1]);
    failRequest(script());
    expect(loader.getSnapshot().status).toBe('failed');

    loader.retry();

    expect(loader.getSnapshot()).toEqual({ status: 'loading', overdue: false });
    const tag = script();
    expect(tag.src.startsWith(`${SMART_CAPTCHA_SRC}&_=`)).toBe(true);
    // the new series has its own budget and its own report
    jest.advanceTimersByTime(LOAD_TIMEOUT - 1);
    expect(loader.getSnapshot()).toEqual({ status: 'loading', overdue: false });
    jest.advanceTimersByTime(1);
    expect(loader.getSnapshot()).toEqual({ status: 'loading', overdue: true });
    expect(onFailure).toHaveBeenCalledTimes(2);
    expect(onFailure).toHaveBeenLastCalledWith('timeout', {
        attempts: 3,
        outcomes: ['stall', 'stall'],
        elapsedMs: LOAD_TIMEOUT,
    });
});

test('retry-of-an-overdue-series-replaces-the-request-in-flight', () => {
    const { loader } = setup();
    loader.load();
    jest.advanceTimersByTime(
        ATTEMPT_TIMEOUT + RETRY_DELAYS[0] + ATTEMPT_TIMEOUT + RETRY_DELAYS[1]
    );
    const hung = script();
    jest.advanceTimersByTime(LOAD_TIMEOUT - 14_000);

    loader.retry();

    expect(hung.isConnected).toBe(false);
    const fresh = script();
    expect(fresh).not.toBe(hung);
    expect(loader.getSnapshot()).toEqual({ status: 'loading', overdue: false });
    runScript(fresh);
    expect(loader.getSnapshot()).toEqual({ status: 'ready', api: API });
});

test('retry-does-nothing-while-the-series-is-still-in-time-or-done', () => {
    const { loader } = setup();
    loader.retry();
    expect(loader.getSnapshot()).toEqual({ status: 'idle' });

    loader.load();
    const tag = script();
    loader.retry();
    expect(script()).toBe(tag);

    runScript(tag);
    loader.retry();
    expect(loader.getSnapshot()).toEqual({ status: 'ready', api: API });
    expect(scripts()).toHaveLength(1);
});

test('an-abandoned-request-that-runs-late-still-brings-the-captcha', () => {
    const { loader } = setup();
    loader.load();
    const first = script();
    jest.advanceTimersByTime(ATTEMPT_TIMEOUT);
    expect(first.isConnected).toBe(false);

    // a removed tag that was still downloading runs anyway and calls back
    runScript(first);

    expect(loader.getSnapshot()).toEqual({ status: 'ready', api: API });
    // the pending retry is cancelled
    jest.advanceTimersByTime(RETRY_DELAYS[0]);
    expect(scripts()).toHaveLength(0);
});

test('a-late-script-after-giving-up-replaces-the-failure-with-the-captcha', () => {
    const { loader } = setup();
    loader.load();
    jest.advanceTimersByTime(LOAD_TIMEOUT * 2);
    expect(loader.getSnapshot()).toEqual({
        status: 'failed',
        failure: 'timeout',
    });

    win.smartCaptcha = API;
    win.__onSmartCaptchaReady?.();

    expect(loader.getSnapshot()).toEqual({ status: 'ready', api: API });
});

test('events-of-an-abandoned-tag-do-not-touch-the-current-request', () => {
    const { loader } = setup();
    loader.load();
    const first = script();
    jest.advanceTimersByTime(ATTEMPT_TIMEOUT + RETRY_DELAYS[0]);
    const second = script();

    failRequest(first);
    first.dispatchEvent(new Event('load'));

    expect(script()).toBe(second);
    expect(loader.getSnapshot()).toEqual({ status: 'loading', overdue: false });
    // and the second request keeps its own timer
    jest.advanceTimersByTime(ATTEMPT_TIMEOUT);
    expect(second.isConnected).toBe(false);
});

test('a-script-that-loads-with-the-api-but-without-calling-back-is-accepted', () => {
    const { loader } = setup();
    loader.load();

    win.smartCaptcha = API;
    script().dispatchEvent(new Event('load'));

    expect(loader.getSnapshot()).toEqual({ status: 'ready', api: API });
});

test('a-script-that-loads-without-the-api-counts-as-silent', () => {
    const { loader } = setup();
    loader.load();
    const first = script();

    // for example an error page served with status 200
    first.dispatchEvent(new Event('load'));
    expect(loader.getSnapshot()).toEqual({ status: 'loading', overdue: false });

    jest.advanceTimersByTime(ATTEMPT_TIMEOUT + RETRY_DELAYS[0]);
    expect(script()).not.toBe(first);
});

test('an-incomplete-api-is-not-taken-for-the-captcha', () => {
    const { loader } = setup();
    loader.load();

    win.smartCaptcha = { render: () => 1 };
    win.__onSmartCaptchaReady?.();

    expect(loader.getSnapshot()).toEqual({ status: 'loading', overdue: false });
});

test('a-ready-callback-set-by-someone-else-keeps-working', () => {
    const previous = jest.fn();
    win.__onSmartCaptchaReady = previous;
    const { loader } = setup();
    loader.load();

    runScript(script());

    expect(previous).toHaveBeenCalledTimes(1);
    expect(loader.getSnapshot()).toEqual({ status: 'ready', api: API });
});

test('a-throwing-ready-callback-of-someone-else-does-not-cost-the-captcha', () => {
    win.__onSmartCaptchaReady = () => {
        throw new Error('foreign callback failed');
    };
    const { loader } = setup();
    loader.load();
    win.smartCaptcha = API;

    expect(() => win.__onSmartCaptchaReady?.()).toThrow(
        'foreign callback failed'
    );
    expect(loader.getSnapshot()).toEqual({ status: 'ready', api: API });
});

test('a-retry-from-a-listener-gets-a-report-of-its-own', () => {
    const { loader, onFailure } = setup();
    // a form that retries the moment it hears about the failure
    loader.subscribe(() => {
        if (loader.getSnapshot().status === 'failed') {
            loader.retry();
        }
    });
    loader.load();
    failRequest(script());
    jest.advanceTimersByTime(RETRY_DELAYS[0]);
    failRequest(script());
    jest.advanceTimersByTime(RETRY_DELAYS[1]);
    failRequest(script());
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(loader.getSnapshot()).toEqual({ status: 'loading', overdue: false });

    jest.advanceTimersByTime(LOAD_TIMEOUT);

    expect(onFailure).toHaveBeenCalledTimes(2);
    expect(onFailure).toHaveBeenLastCalledWith('timeout', expect.anything());
});

test('a-url-without-a-query-gets-the-cache-busting-parameter-as-its-query', () => {
    const loader = createCaptchaScriptLoader({
        src: 'https://example.test/captcha.js',
        attemptTimeoutMs: ATTEMPT_TIMEOUT,
        retryDelaysMs: RETRY_DELAYS,
        loadTimeoutMs: LOAD_TIMEOUT,
        window: win as unknown as Window,
    });
    loader.load();
    failRequest(script());
    jest.advanceTimersByTime(RETRY_DELAYS[0]);

    expect(script().src).toMatch(/^https:\/\/example\.test\/captcha\.js\?_=/);
});

test('an-unsubscribed-form-hears-nothing', () => {
    const { loader } = setup();
    const form = jest.fn();
    const unsubscribe = loader.subscribe(form);
    unsubscribe();

    loader.load();

    expect(form).not.toHaveBeenCalled();
});
