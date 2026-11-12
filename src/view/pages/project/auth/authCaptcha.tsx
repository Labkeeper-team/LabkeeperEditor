import { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { SmartCaptcha } from '@yandex/smart-captcha';
import { Secrets } from '../../../../constants.ts';
import { controller } from '../../../../main.tsx';
import { Events } from '../../../../model/service/ObserverService.ts';
import { Button } from '../../../components/button';
import { Typography } from '../../../components/typography';
import { colors } from '../../../styles/colors.ts';
import { useDictionary } from '../../../store/selectors/translations.ts';
import { StorageState } from '../../../store';
import { AuthErrorMessage } from './authErrorMessage.tsx';

/**
 * Сколько ждём скрипт капчи. Блокировщик рекламы обрывает загрузку сразу, и
 * об этом сообщает сам загрузчик, а зависшая сеть не отвечает вовсе
 */
export const CAPTCHA_LOAD_TIMEOUT_MS = 15_000;

/**
 * script: captcha.js не загрузился (блокировщик, VPN, корпоративная сеть);
 * timeout: не загрузился за CAPTCHA_LOAD_TIMEOUT_MS;
 * network: виджет загружен, но не достучался до сервера Яндекса;
 * javascript: ошибка внутри загруженного скрипта
 */
type CaptchaFailure = 'script' | 'timeout' | 'network' | 'javascript';

/**
 * Загрузчик SmartCaptcha запрашивает скрипт один раз на страницу и о сбое
 * сообщает только первому виджету. Следующий виджет, например в форме кода
 * после формы входа, скрипт уже не запросит: про сбой он узнаёт отсюда
 */
let scriptFailed = false;

const scriptLoaded = () =>
    Boolean((window as { smartCaptcha?: unknown }).smartCaptcha);

/**
 * GH-253: капча с понятным сообщением, когда она не загрузилась, и со сбросом
 * токена, когда её проверка устарела. onToken получает пустую строку, когда
 * токена больше нет: кнопка формы снова неактивна
 */
export const AuthCaptcha = ({
    form,
    resetKey,
    onToken,
}: {
    form: 'login' | 'email';
    /** Форма меняет ключ после отказа сервера, и капча проходится заново */
    resetKey: number;
    onToken: (token: string) => void;
}) => {
    const dictionary = useSelector(useDictionary);
    const language = useSelector(
        (state: StorageState) => state.persistence.language
    );
    const [attempt, setAttempt] = useState(0);
    const [failure, setFailure] = useState<CaptchaFailure | null>(() =>
        scriptFailed ? 'script' : null
    );
    const [expired, setExpired] = useState(false);
    // одно событие на попытку: загрузчик и виджет могут сообщить об одном сбое дважды
    const reported = useRef(false);

    const report = useCallback(
        (reason: CaptchaFailure) => {
            if (reported.current) {
                return;
            }
            reported.current = true;
            controller.trackUiEvent(Events.EVENT_CAPTCHA_FAILED, {
                reason,
                form,
            });
        },
        [form]
    );

    const fail = useCallback(
        (reason: CaptchaFailure) => {
            onToken('');
            setFailure((current) => current ?? reason);
            report(reason);
        },
        [onToken, report]
    );

    // сбой, о котором загрузчик сообщил до этого виджета, тоже надо посчитать
    useEffect(() => {
        if (scriptFailed) {
            report('script');
        }
    }, [report]);

    useEffect(() => {
        if (failure || scriptLoaded()) {
            return;
        }
        const timer = window.setTimeout(() => {
            if (!scriptLoaded()) {
                fail(scriptFailed ? 'script' : 'timeout');
            }
        }, CAPTCHA_LOAD_TIMEOUT_MS);
        return () => window.clearTimeout(timer);
    }, [attempt, failure, fail]);

    const onSuccess = useCallback(
        (token: string) => {
            setFailure(null);
            setExpired(false);
            onToken(token);
        },
        [onToken]
    );

    const onTokenExpired = useCallback(() => {
        setExpired(true);
        onToken('');
    }, [onToken]);

    const onNetworkError = useCallback(() => fail('network'), [fail]);

    const onJavascriptError = useCallback(() => {
        if (scriptLoaded()) {
            fail('javascript');
            return;
        }
        scriptFailed = true;
        fail('script');
    }, [fail]);

    // без скрипта новый виджет его не запросит: поможет только перезагрузка страницы
    const pageReloadNeeded = failure === 'script' || failure === 'timeout';

    const retry = () => {
        if (!scriptLoaded()) {
            window.location.reload();
            return;
        }
        reported.current = false;
        setFailure(null);
        setExpired(false);
        setAttempt((current) => current + 1);
    };

    return (
        <div className="auth-captcha" data-captcha-failure={failure ?? ''}>
            {!pageReloadNeeded && (
                <SmartCaptcha
                    key={`${resetKey}:${attempt}`}
                    language={language === 'zh' ? 'en' : language}
                    sitekey={Secrets.yandexCaptchaSiteKey}
                    onSuccess={onSuccess}
                    onTokenExpired={onTokenExpired}
                    onNetworkError={onNetworkError}
                    onJavascriptError={onJavascriptError}
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
                        title={
                            pageReloadNeeded
                                ? dictionary.authorization.captcha.reloadPage
                                : dictionary.authorization.captcha.reloadCaptcha
                        }
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
