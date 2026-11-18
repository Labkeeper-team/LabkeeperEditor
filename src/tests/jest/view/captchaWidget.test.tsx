import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { act, render, screen } from '@testing-library/react';
import { type ReactElement, StrictMode } from 'react';
import type {
    SmartCaptchaApi,
    SmartCaptchaEvent,
} from '../../../view/pages/project/auth/captchaScript.ts';
import {
    CAPTCHA_RENDER_TIMEOUT_MS,
    CaptchaWidget,
    type CaptchaWidgetFailure,
} from '../../../view/pages/project/auth/captchaWidget.tsx';

// The widget is drawn through window.smartCaptcha, not through <SmartCaptcha>
// of @yandex/smart-captcha. Here window.smartCaptcha is a fake that keeps its
// widgets: what was rendered and destroyed, and which handlers are live

const LOADING = 'Loading the captcha…';

type Handler = (data?: unknown) => void;

function fakeApi({
    draws = true,
    renderError,
}: {
    /** whether render() puts the checkbox iframe into the container */
    draws?: boolean;
    renderError?: Error;
} = {}) {
    let nextId = 0;
    const containers = new Map<number, HTMLElement>();
    const handlers = new Map<number, Map<SmartCaptchaEvent, Handler>>();
    const rendered: Array<{ id: number; params: unknown }> = [];
    const destroyed: number[] = [];
    const api: SmartCaptchaApi = {
        render(container, params) {
            if (renderError) {
                throw renderError;
            }
            nextId += 1;
            containers.set(nextId, container);
            handlers.set(nextId, new Map());
            rendered.push({ id: nextId, params });
            if (draws) {
                container.innerHTML = '<iframe title="SmartCaptcha"></iframe>';
            }
            return nextId;
        },
        destroy(id) {
            if (id === undefined) {
                return;
            }
            destroyed.push(id);
            containers.get(id)?.replaceChildren();
        },
        subscribe(id, event, callback) {
            handlers.get(id)?.set(event, callback);
            return () => {
                handlers.get(id)?.delete(event);
            };
        },
    };
    return {
        api,
        rendered,
        destroyed,
        /** the widget raises an event, as captcha.js does from its iframe */
        emit: (id: number, event: SmartCaptchaEvent, data?: unknown) =>
            act(() => handlers.get(id)?.get(event)?.(data)),
        /** handlers a widget still has: a destroyed widget must have none */
        liveHandlers: (id: number) => handlers.get(id)?.size ?? 0,
        /** the widget draws its iframe later, not inside render() */
        drawLate: (id: number) => {
            containers.get(id)!.innerHTML =
                '<iframe title="SmartCaptcha"></iframe>';
        },
    };
}

function callbacks() {
    return {
        onSuccess: jest.fn<(token: string) => void>(),
        onTokenExpired: jest.fn<() => void>(),
        onFailure:
            jest.fn<
                (failure: CaptchaWidgetFailure, detail?: unknown) => void
            >(),
    };
}

/** MutationObserver calls back in a microtask: the act has to wait for it */
async function mount(element: ReactElement) {
    let result: ReturnType<typeof render> | undefined;
    await act(async () => {
        result = render(element);
    });
    return result!;
}

const flushObservers = () => act(async () => {});

beforeEach(() => {
    // only timers: React's act and the observers need real microtasks
    jest.useFakeTimers({
        doNotFake: ['queueMicrotask', 'nextTick', 'setImmediate'],
    });
});

afterEach(() => {
    jest.useRealTimers();
});

test('the-widget-is-drawn-with-the-sitekey-and-language-and-the-placeholder-gives-way', async () => {
    const fake = fakeApi();

    await mount(
        <CaptchaWidget
            api={fake.api}
            sitekey="site-key"
            language="ru"
            loadingText={LOADING}
            {...callbacks()}
        />
    );

    expect(fake.rendered).toEqual([
        { id: 1, params: { sitekey: 'site-key', hl: 'ru' } },
    ]);
    expect(document.querySelector('.smart-captcha iframe')).not.toBeNull();
    expect(screen.queryByText(LOADING)).toBeNull();
});

test('until-the-iframe-appears-the-form-shows-progress-not-an-empty-box', async () => {
    const fake = fakeApi({ draws: false });
    const handlers = callbacks();
    await mount(
        <CaptchaWidget
            api={fake.api}
            sitekey="site-key"
            language="en"
            loadingText={LOADING}
            {...handlers}
        />
    );
    expect(screen.getByRole('status').textContent).toBe(LOADING);

    act(() => jest.advanceTimersByTime(CAPTCHA_RENDER_TIMEOUT_MS / 2));
    fake.drawLate(1);
    await flushObservers();

    expect(screen.queryByText(LOADING)).toBeNull();
    // drawn in time: the watchdog is off
    act(() => jest.advanceTimersByTime(CAPTCHA_RENDER_TIMEOUT_MS));
    expect(handlers.onFailure).not.toHaveBeenCalled();
});

test('a-widget-that-never-draws-is-a-render-failure-after-the-timeout', async () => {
    const fake = fakeApi({ draws: false });
    const handlers = callbacks();
    await mount(
        <CaptchaWidget
            api={fake.api}
            sitekey="site-key"
            language="en"
            loadingText={LOADING}
            {...handlers}
        />
    );

    act(() => jest.advanceTimersByTime(CAPTCHA_RENDER_TIMEOUT_MS - 1));
    expect(handlers.onFailure).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));

    expect(handlers.onFailure).toHaveBeenCalledTimes(1);
    expect(handlers.onFailure).toHaveBeenCalledWith('render');
});

test('a-render-that-throws-is-a-render-failure-at-once', async () => {
    const error = new Error('render failed');
    const fake = fakeApi({ renderError: error });
    const handlers = callbacks();

    await mount(
        <CaptchaWidget
            api={fake.api}
            sitekey="site-key"
            language="en"
            loadingText={LOADING}
            {...handlers}
        />
    );

    expect(handlers.onFailure).toHaveBeenCalledWith('render', error);
    // and no second report from the watchdog later
    act(() => jest.advanceTimersByTime(CAPTCHA_RENDER_TIMEOUT_MS));
    expect(handlers.onFailure).toHaveBeenCalledTimes(1);
});

test('widget-events-reach-the-latest-callbacks-without-drawing-it-again', async () => {
    const fake = fakeApi();
    const first = callbacks();
    const latest = callbacks();
    const { rerender } = await mount(
        <CaptchaWidget
            api={fake.api}
            sitekey="site-key"
            language="en"
            loadingText={LOADING}
            {...first}
        />
    );

    // the form re-renders with new functions on every keystroke
    rerender(
        <CaptchaWidget
            api={fake.api}
            sitekey="site-key"
            language="en"
            loadingText={LOADING}
            {...latest}
        />
    );
    fake.emit(1, 'success', 'token-1');
    fake.emit(1, 'token-expired');
    fake.emit(1, 'network-error');
    fake.emit(1, 'javascript-error', { message: 'boom' });

    expect(fake.rendered).toHaveLength(1);
    expect(first.onSuccess).not.toHaveBeenCalled();
    expect(latest.onSuccess).toHaveBeenCalledWith('token-1');
    expect(latest.onTokenExpired).toHaveBeenCalledTimes(1);
    expect(latest.onFailure.mock.calls).toEqual([
        ['network'],
        ['javascript', { message: 'boom' }],
    ]);
});

test('unmounting-destroys-the-widget-and-silences-it', async () => {
    const fake = fakeApi({ draws: false });
    const handlers = callbacks();
    const { unmount } = await mount(
        <CaptchaWidget
            api={fake.api}
            sitekey="site-key"
            language="en"
            loadingText={LOADING}
            {...handlers}
        />
    );

    // for example the modal is closed while the widget is still drawing
    unmount();

    expect(fake.destroyed).toEqual([1]);
    expect(fake.liveHandlers(1)).toBe(0);
    act(() => jest.advanceTimersByTime(CAPTCHA_RENDER_TIMEOUT_MS * 2));
    expect(handlers.onFailure).not.toHaveBeenCalled();
});

test('strict-mode-leaves-exactly-one-live-widget', async () => {
    const fake = fakeApi();
    const handlers = callbacks();

    await mount(
        <StrictMode>
            <CaptchaWidget
                api={fake.api}
                sitekey="site-key"
                language="en"
                loadingText={LOADING}
                {...handlers}
            />
        </StrictMode>
    );

    // React mounts, unmounts and mounts again: the first widget is destroyed
    expect(fake.rendered.map(({ id }) => id)).toEqual([1, 2]);
    expect(fake.destroyed).toEqual([1]);
    expect(fake.liveHandlers(1)).toBe(0);
    expect(document.querySelectorAll('.smart-captcha iframe')).toHaveLength(1);
    expect(screen.queryByText(LOADING)).toBeNull();
    fake.emit(2, 'success', 'token-2');
    expect(handlers.onSuccess).toHaveBeenCalledWith('token-2');
    act(() => jest.advanceTimersByTime(CAPTCHA_RENDER_TIMEOUT_MS * 2));
    expect(handlers.onFailure).not.toHaveBeenCalled();
});

test('a-new-key-replaces-the-widget-with-a-fresh-one', async () => {
    const fake = fakeApi();
    const handlers = callbacks();
    const widget = (key: string) => (
        <CaptchaWidget
            key={key}
            api={fake.api}
            sitekey="site-key"
            language="en"
            loadingText={LOADING}
            {...handlers}
        />
    );
    const { rerender } = await mount(widget('0:0:en'));

    // the retry button or a refused login re-keys the widget
    await act(async () => {
        rerender(widget('0:1:en'));
    });

    expect(fake.destroyed).toEqual([1]);
    expect(fake.rendered.map(({ id }) => id)).toEqual([1, 2]);
    expect(fake.liveHandlers(1)).toBe(0);
    expect(fake.liveHandlers(2)).toBe(4);
});

test('a-throwing-destroy-does-not-break-the-unmount', async () => {
    const fake = fakeApi();
    fake.api.destroy = () => {
        throw new Error('destroy failed');
    };
    const { unmount } = await mount(
        <CaptchaWidget
            api={fake.api}
            sitekey="site-key"
            language="en"
            loadingText={LOADING}
            {...callbacks()}
        />
    );

    expect(() => unmount()).not.toThrow();
});
