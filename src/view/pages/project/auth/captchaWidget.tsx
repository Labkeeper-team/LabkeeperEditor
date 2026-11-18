import {
    type CSSProperties,
    useEffect,
    useEffectEvent,
    useRef,
    useState,
} from 'react';
import { Typography } from '../../../components/typography';
import { colors } from '../../../styles/colors.ts';
import type { SmartCaptchaApi, SmartCaptchaEvent } from './captchaScript.ts';

/**
 * How long a widget may stay without its iframe after render(). The script
 * can be on the page while the widget itself never draws (its frame is
 * blocked, render() silently does nothing). Without this check the form
 * showed an empty box and no explanation, like a script that never loaded
 */
export const CAPTCHA_RENDER_TIMEOUT_MS = 10_000;

/** Height @yandex/smart-captcha gives the widget container: the checkbox frame fits in it */
const CAPTCHA_HEIGHT_PX = 102;

const OVERLAY_STYLE: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
};

/**
 * network: the widget could not reach the Yandex servers;
 * javascript: the widget reported an error in its own code;
 * render: render() threw, or no iframe appeared in CAPTCHA_RENDER_TIMEOUT_MS
 */
export type CaptchaWidgetFailure = 'network' | 'javascript' | 'render';

/**
 * Stands where the widget will be while the script loads or the widget
 * draws. It has the widget's height, so the form does not jump when the
 * captcha appears, and the person sees progress instead of an empty box
 */
export const CaptchaPlaceholder = ({
    text,
    overlay = false,
}: {
    text: string;
    /** Covers the widget container until the widget has drawn into it */
    overlay?: boolean;
}) => (
    <div
        role="status"
        className="auth-captcha-loading"
        style={{
            height: CAPTCHA_HEIGHT_PX,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px solid ${colors.gray40}`,
            borderRadius: 8,
            backgroundColor: colors.white,
            ...(overlay ? OVERLAY_STYLE : undefined),
        }}
    >
        <Typography color={colors.gray30} type="body" text={text} />
    </div>
);

/** Clean-up of a widget that is going away must not take the auth form down with it */
const quietly = (action: () => void) => {
    try {
        action();
    } catch {
        // captcha.js threw while tearing down its own widget: nothing left to save
    }
};

/**
 * One SmartCaptcha widget, drawn through window.smartCaptcha once the page
 * has the script (see captchaScript.ts for why not <SmartCaptcha>). The
 * parent re-keys it to get a fresh widget: after a failed login, a retry or a
 * change of language
 */
export const CaptchaWidget = ({
    api,
    sitekey,
    language,
    loadingText,
    onSuccess,
    onTokenExpired,
    onFailure,
}: {
    api: SmartCaptchaApi;
    sitekey: string;
    language: string;
    loadingText: string;
    onSuccess: (token: string) => void;
    onTokenExpired: () => void;
    onFailure: (failure: CaptchaWidgetFailure, detail?: unknown) => void;
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [drawn, setDrawn] = useState(false);
    // The form passes new callbacks on every render; as effect events they do
    // not re-create the widget, which would throw away a check in progress
    const handleSuccess = useEffectEvent(onSuccess);
    const handleTokenExpired = useEffectEvent(onTokenExpired);
    const handleFailure = useEffectEvent(onFailure);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) {
            return;
        }
        // StrictMode and fast re-keying run this clean-up before the
        // observer and the timer below fire: they must not touch a dead widget
        let disposed = false;
        let widgetId: number | undefined;
        const unsubscribes: Array<(() => void) | undefined> = [];

        const checkDrawn = () => {
            if (disposed || !container.querySelector('iframe')) {
                return;
            }
            observer.disconnect();
            clearTimeout(watchdog);
            setDrawn(true);
        };
        // Observe before render(): the widget may insert its frame synchronously
        const observer = new MutationObserver(checkDrawn);
        observer.observe(container, { childList: true, subtree: true });
        const watchdog = setTimeout(() => {
            observer.disconnect();
            if (!disposed) {
                handleFailure('render');
            }
        }, CAPTCHA_RENDER_TIMEOUT_MS);

        try {
            const id = api.render(container, { sitekey, hl: language });
            widgetId = id;
            // one by one, so a subscription made before a throw is still undone
            const listen = (
                event: SmartCaptchaEvent,
                callback: (data?: unknown) => void
            ) => unsubscribes.push(api.subscribe(id, event, callback));
            listen('success', (token) =>
                handleSuccess(typeof token === 'string' ? token : '')
            );
            listen('token-expired', () => handleTokenExpired());
            listen('network-error', () => handleFailure('network'));
            listen('javascript-error', (error) =>
                handleFailure('javascript', error)
            );
        } catch (error) {
            // a widget we cannot set up never gets a token: same as one that did not draw
            observer.disconnect();
            clearTimeout(watchdog);
            handleFailure('render', error);
        }

        return () => {
            disposed = true;
            observer.disconnect();
            clearTimeout(watchdog);
            unsubscribes.forEach((unsubscribe) =>
                quietly(() => unsubscribe?.())
            );
            if (widgetId !== undefined) {
                const id = widgetId;
                quietly(() => api.destroy(id));
            }
        };
    }, [api, sitekey, language]);

    return (
        <div style={{ position: 'relative' }}>
            <div
                ref={containerRef}
                className="smart-captcha"
                style={{ height: CAPTCHA_HEIGHT_PX }}
            />
            {!drawn && <CaptchaPlaceholder text={loadingText} overlay />}
        </div>
    );
};
