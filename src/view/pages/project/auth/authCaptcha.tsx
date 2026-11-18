import * as Sentry from '@sentry/react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useSelector } from 'react-redux';
import { Secrets } from '../../../../constants.ts';
import { controller } from '../../../../main.tsx';
import { Events } from '../../../../model/service/ObserverService.ts';
import { Button } from '../../../components/button';
import { Typography } from '../../../components/typography';
import { colors } from '../../../styles/colors.ts';
import { useDictionary } from '../../../store/selectors/translations.ts';
import { StorageState } from '../../../store';
import { AuthErrorMessage } from './authErrorMessage.tsx';
import {
    type CaptchaScriptFailure,
    createCaptchaScriptLoader,
    SMART_CAPTCHA_SRC,
} from './captchaScript.ts';
import {
    CaptchaPlaceholder,
    CaptchaWidget,
    type CaptchaWidgetFailure,
} from './captchaWidget.tsx';

/**
 * How long the page waits for captcha.js before the forms show the timeout
 * error. Counted once per page from the first form that needs the captcha,
 * not per form: an ad blocker fails the requests at once, but a hung network
 * never answers at all
 */
export const CAPTCHA_LOAD_TIMEOUT_MS = 15_000;

/** captcha.js is small: a request silent for this long is stuck, not slow */
const CAPTCHA_ATTEMPT_TIMEOUT_MS = 5_000;

/**
 * Three requests in all. A dropped connection or a 5xx gets two more
 * chances, and an ad blocker, which fails every request, is still explained
 * within about four seconds
 */
const CAPTCHA_RETRY_DELAYS_MS = [1_000, 3_000];

/** Every reason goes to OpenPanel as is (EVENT_CAPTCHA_FAILED reason) */
type CaptchaFailure = CaptchaScriptFailure | CaptchaWidgetFailure;

type CaptchaForm = 'login' | 'email';

/**
 * Captcha failures go to Sentry as well as to OpenPanel: OpenPanel counts
 * them, Sentry keeps the details. Only reasons, timings and error messages are
 * sent, never the captcha token: it stands for a passed check
 */
function captureCaptchaFailure(
    reason: CaptchaFailure,
    extra: Record<string, unknown>,
    form?: CaptchaForm
) {
    Sentry.captureMessage(`SmartCaptcha failed: ${reason}`, {
        // the cause is usually on the person's side (blocker, VPN, network), not a bug of ours
        level: 'warning',
        fingerprint: ['captcha-failed', reason],
        tags: {
            'captcha.reason': reason,
            ...(form && { 'captcha.form': form }),
        },
        extra: { ...extra, online: navigator.onLine },
    });
}

/** A thrown Error does not survive Sentry's normalisation of extra as is: keep its text */
const describeDetail = (detail: unknown) =>
    detail instanceof Error ? `${detail.name}: ${detail.message}` : detail;

/**
 * One loader for the page, shared by both forms and every reopening of the
 * auth modal. Its failures belong to the page, so they reach Sentry from here,
 * once per series of requests, however many forms show them
 */
const captchaScript = createCaptchaScriptLoader({
    src: SMART_CAPTCHA_SRC,
    attemptTimeoutMs: CAPTCHA_ATTEMPT_TIMEOUT_MS,
    retryDelaysMs: CAPTCHA_RETRY_DELAYS_MS,
    loadTimeoutMs: CAPTCHA_LOAD_TIMEOUT_MS,
    onFailure: (failure, details) =>
        captureCaptchaFailure(failure, { ...details }),
});

/**
 * GH-253: the captcha with a clear message when it does not load and a reset
 * of the token when its check expires. onToken gets an empty string when there
 * is no valid token any more, so the form's button is disabled again
 */
export const AuthCaptcha = ({
    form,
    resetKey,
    onToken,
}: {
    form: CaptchaForm;
    /** The form changes the key after the server refuses, and the captcha is passed again */
    resetKey: number;
    onToken: (token: string) => void;
}) => {
    const dictionary = useSelector(useDictionary);
    const language = useSelector(
        (state: StorageState) => state.persistence.language
    );
    const script = useSyncExternalStore(
        captchaScript.subscribe,
        captchaScript.getSnapshot
    );
    // bumped by the retry button: a new key gives a freshly drawn widget
    const [widgetAttempt, setWidgetAttempt] = useState(0);
    const [widgetFailure, setWidgetFailure] = useState<{
        reason: CaptchaWidgetFailure;
        detail?: unknown;
    } | null>(null);
    const [expired, setExpired] = useState(false);
    // the failure already reported for what the person sees now
    const reported = useRef<CaptchaFailure | null>(null);

    // The first form that needs the captcha starts the page-wide load, the
    // others join it. Idempotent, so StrictMode's double mount is harmless
    useEffect(() => captchaScript.load(), []);

    // A failure of the script outlives any form: a form mounted later, for
    // example after reopening the modal, shows it at once
    const scriptFailure: CaptchaScriptFailure | null =
        script.status === 'failed'
            ? script.failure
            : script.status === 'loading' && script.overdue
              ? 'timeout'
              : null;
    const failure: CaptchaFailure | null =
        scriptFailure ?? widgetFailure?.reason ?? null;

    useEffect(() => {
        if (!failure) {
            // whatever fails next, for example after a retry, is a new failure
            reported.current = null;
            return;
        }
        // one event per failure: StrictMode and re-renders run this again
        if (reported.current === failure) {
            return;
        }
        reported.current = failure;
        // OpenPanel counts what each form showed: both forms of a blocked page report
        controller.trackUiEvent(Events.EVENT_CAPTCHA_FAILED, {
            reason: failure,
            form,
        });
        // failures of the script reach Sentry from the loader, once per page
        if (widgetFailure?.reason === failure) {
            captureCaptchaFailure(
                failure,
                { detail: describeDetail(widgetFailure.detail) },
                form
            );
        }
    }, [failure, form, widgetFailure]);

    const onSuccess = (token: string) => {
        // the widget recovered by itself, for example the network came back
        setWidgetFailure(null);
        setExpired(false);
        onToken(token);
    };

    const onTokenExpired = () => {
        setExpired(true);
        onToken('');
    };

    const onWidgetFailure = (
        reason: CaptchaWidgetFailure,
        detail?: unknown
    ) => {
        onToken('');
        // the first failure explains the rest: a widget that lost the network also errs inside
        setWidgetFailure((current) => current ?? { reason, detail });
    };

    const retry = () => {
        setExpired(false);
        setWidgetFailure(null);
        if (scriptFailure) {
            // in place, without reloading the page: new requests with fresh URLs
            captchaScript.retry();
            return;
        }
        setWidgetAttempt((current) => current + 1);
    };

    const hl = language === 'zh' ? 'en' : language;

    return (
        <div className="auth-captcha" data-captcha-failure={failure ?? ''}>
            {script.status === 'ready' &&
                widgetFailure?.reason !== 'render' && (
                    <CaptchaWidget
                        key={`${resetKey}:${widgetAttempt}:${hl}`}
                        api={script.api}
                        sitekey={Secrets.yandexCaptchaSiteKey}
                        language={hl}
                        loadingText={dictionary.authorization.captcha.loading}
                        onSuccess={onSuccess}
                        onTokenExpired={onTokenExpired}
                        onFailure={onWidgetFailure}
                    />
                )}
            {script.status !== 'ready' && !scriptFailure && (
                <CaptchaPlaceholder
                    text={dictionary.authorization.captcha.loading}
                />
            )}
            {expired && !failure && (
                <Typography
                    color={colors.gray20}
                    type="body"
                    text={dictionary.authorization.captcha.expired}
                />
            )}
            {failure && (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                    }}
                >
                    <AuthErrorMessage
                        text={dictionary.authorization.captcha.loadFailed}
                    />
                    <Button
                        classname="full-width"
                        title={dictionary.authorization.captcha.reloadCaptcha}
                        color="blue"
                        rounded
                        type="rounded"
                        minimize={true}
                        onPress={retry}
                    />
                </div>
            )}
        </div>
    );
};
