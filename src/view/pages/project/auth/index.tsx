import { Typography } from '../../../components/typography';
import { colors } from '../../../styles/colors.ts';
import { Button } from '../../../components/button';
import { Login2Icon } from '../../../icons';
import { Modal } from '../../../components/modal';
import { useSelector, useDispatch } from 'react-redux';
import { useDictionary } from '../../../../viewModel/store/selectors/translations.ts';
import { Input } from '../../../components/input';
import { useState, ChangeEvent, useMemo } from 'react';
import { setCurrentView } from '../../../../viewModel/store/slices/auth';
import { StorageState } from '../../../../viewModel/store';
import { AppDispatch } from '../../../../viewModel/store';
import { SmartCaptcha } from '@yandex/smart-captcha';
import { Providers, Secrets, URLS } from '../../../../constants.ts';
import {
    onAuthClosedRequest,
    onEmailSendButtonClickedRequest,
    onForgotPasswordButtonClickedRequest,
    onFormLoginClickedRequest,
    onRegistrationButtonClickedRequest,
    onSendCodeButtonClickedRequest,
    onSendPasswordButtonClickedRequest,
} from '../../../../controller';

const LoginView = () => {
    const dispatch = useDispatch<AppDispatch>();

    // State
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [token, setToken] = useState('');

    // Selectors
    const dictionary = useSelector(useDictionary);
    const language = useSelector(
        (state: StorageState) => state.persistence.language
    );
    const loginRequest = useSelector(
        (state: StorageState) => state.auth.loginRequest
    );

    const errorMessage = useMemo((): string => {
        if (loginRequest === 'bad_credentials') {
            return dictionary.authorization.errors.credentialsError;
        }
        if (loginRequest === 'oauth_error') {
            return dictionary.authorization.errors.oauthError;
        }
        return '';
    }, [loginRequest]);

    return (
        <div
            className="auth-modal"
            style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '40px',
            }}
        >
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <Typography
                    className="auth-header"
                    color={colors.gray10}
                    type="h2"
                    text={dictionary.authorization.title}
                />
            </div>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px',
                }}
            >
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        const userName =
                            e.currentTarget.elements['username'].value;
                        const password =
                            e.currentTarget.elements['password'].value;
                        const captcha =
                            e.currentTarget.elements['captcha'].value;

                        dispatch(
                            onFormLoginClickedRequest({
                                userName: userName,
                                password: password,
                                captcha: captcha,
                            })
                        );
                    }}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px',
                    }}
                >
                    <Input
                        required={true}
                        name={'username'}
                        value={login}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            setLogin(e.target.value)
                        }
                        placeholder={dictionary.authorization.login}
                        type="text"
                    />
                    <Input
                        required={true}
                        name={'password'}
                        value={password}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            setPassword(e.target.value)
                        }
                        placeholder={dictionary.authorization.password}
                        type="password"
                    />
                    {!!Secrets.yandexCaptchaSiteKey && (
                        <input required hidden value={token} name="captcha" />
                    )}
                    {errorMessage && (
                        <div style={{ textAlign: 'center' }}>
                            <Typography
                                color={colors.gray10}
                                type="body"
                                text={errorMessage}
                            />
                        </div>
                    )}
                    {password && !!Secrets.yandexCaptchaSiteKey && (
                        <SmartCaptcha
                            language={language}
                            sitekey={Secrets.yandexCaptchaSiteKey}
                            onSuccess={setToken}
                        />
                    )}
                    <Button
                        classname="full-width"
                        title={dictionary.authorization.login}
                        color="blue"
                        disabled={!token && !!Secrets.yandexCaptchaSiteKey}
                        rounded
                        type="rounded"
                        minimize={false}
                        buttonType="submit"
                    />
                </form>
                <div
                    style={{
                        display: 'flex',
                        gap: '12px',
                        justifyContent: 'center',
                        width: '100%',
                    }}
                >
                    <Button
                        classname="full-width"
                        title={dictionary.authorization.registration}
                        color="blue"
                        rounded
                        type="rounded"
                        minimize={true}
                        onPress={() => {
                            dispatch(onRegistrationButtonClickedRequest());
                        }}
                    />
                    <Button
                        classname="full-width"
                        title={dictionary.authorization.forgotPassword}
                        color="blue"
                        rounded
                        type="rounded"
                        minimize={true}
                        onPress={() => {
                            dispatch(onForgotPasswordButtonClickedRequest());
                        }}
                    />
                </div>
                <div
                    style={{
                        width: '100%',
                        height: '1px',
                        backgroundColor: colors.gray40,
                        margin: '16px 0',
                        position: 'relative',
                    }}
                >
                    <div
                        style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            backgroundColor: '#fff',
                            padding: '0 16px',
                        }}
                    >
                        <Typography
                            color={colors.gray40}
                            type="body"
                            text={dictionary.or}
                        />
                    </div>
                </div>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                    }}
                >
                    {Providers?.map((provider) => (
                        <Button
                            classname="full-width"
                            title={`${dictionary.authorization.loginVia} ${provider}`}
                            color="blue"
                            rounded
                            type="rounded"
                            titleIcon={
                                provider.toLowerCase() === 'yandex'
                                    ? () => <Login2Icon />
                                    : undefined
                            }
                            minimize={false}
                            onPress={() => {
                                window.location =
                                    URLS.YandexOidcLogin as unknown as string &
                                        Location;
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

const EmailView = () => {
    const [email, setEmail] = useState('');
    const dispatch = useDispatch<AppDispatch>();
    const status = useSelector(
        (state: StorageState) => state.auth.emailRequest
    );
    const dictionary = useSelector(useDictionary);
    const [token, setToken] = useState('');
    const language = useSelector(
        (state: StorageState) => state.persistence.language
    );

    const handleSubmit = async () => {
        if (!email) {
            return;
        }
        dispatch(
            onEmailSendButtonClickedRequest({ email: email, captcha: token })
        );
    };

    const getErrorMessage = () => {
        if (status === 'userExists') {
            return dictionary.authorization.errors.userExists;
        }
        if (status === 'userNotFound') {
            return dictionary.authorization.errors.userNotFound;
        }
        if (status === 'validationError') {
            return dictionary.authorization.errors.invalidEmail;
        }
        return '';
    };

    return (
        <div
            className="auth-modal"
            style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '30px 40px',
            }}
        >
            <Typography
                className="auth-header"
                color={colors.gray10}
                type="h2"
                text={dictionary.authorization.views.email}
            />
            <Typography
                color={colors.gray20}
                type="body"
                text={dictionary.authorization.views.emailSubtitle}
                style={{ marginTop: '16px' }}
            />
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    marginTop: 16,
                }}
            >
                <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    type="text"
                    disabled={status === 'loading'}
                />
                {Secrets.yandexCaptchaSiteKey && (
                    <SmartCaptcha
                        language={language}
                        sitekey={Secrets.yandexCaptchaSiteKey}
                        onSuccess={setToken}
                    />
                )}
                {getErrorMessage() && (
                    <Typography
                        color={colors.gray10}
                        type="body"
                        text={getErrorMessage()}
                    />
                )}
                <Button
                    classname="full-width"
                    title={dictionary.authorization.sendCode}
                    color="blue"
                    rounded
                    type="rounded"
                    minimize={false}
                    onPress={handleSubmit}
                    disabled={status === 'loading' || !token}
                />
            </div>
        </div>
    );
};

const CodeView = () => {
    const [code, setCode] = useState('');
    const dispatch = useDispatch<AppDispatch>();
    const status = useSelector(
        (state: StorageState) => state.auth.codeCheckRequest
    );
    const dictionary = useSelector(useDictionary);

    const handleSubmit = async () => {
        if (!code) {
            return;
        }
        dispatch(onSendCodeButtonClickedRequest({ code: code }));
    };

    return (
        <div
            className="auth-modal"
            style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '30px 40px',
            }}
        >
            <Typography
                className="auth-header"
                color={colors.gray10}
                type="h2"
                text={dictionary.authorization.views.code}
            />
            <Typography
                color={colors.gray20}
                type="body"
                text={dictionary.authorization.views.codeSubtitle}
                style={{ marginTop: '16px' }}
            />
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    marginTop: 16,
                }}
            >
                <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder={dictionary.authorization.confirmCode}
                    type="text"
                    disabled={status === 'loading'}
                />
                {status === 'invalid' && (
                    <Typography
                        color={colors.gray10}
                        type="body"
                        text={dictionary.authorization.errors.invalidCode}
                    />
                )}
                <Button
                    classname="full-width"
                    title={dictionary.authorization.confirmCode}
                    color="blue"
                    rounded
                    type="rounded"
                    minimize={false}
                    onPress={handleSubmit}
                    disabled={status === 'loading'}
                />
            </div>
        </div>
    );
};

const PasswordView = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [localError, setLocalError] = useState('');
    const dispatch = useDispatch<AppDispatch>();
    const status = useSelector(
        (state: StorageState) => state.auth.passwordSetRequest
    );
    const currentEmail = useSelector(
        (state: StorageState) => state.auth.currentEmail
    );
    const verifiedCode = useSelector(
        (state: StorageState) => state.auth.lastVerifiedCode
    );
    const dictionary = useSelector(useDictionary);

    const handleSubmit = async () => {
        if (!password || !confirmPassword || !currentEmail || !verifiedCode) {
            setLocalError(dictionary.authorization.errors.fillAllFields);
            return;
        }
        if (password !== confirmPassword) {
            setLocalError(dictionary.authorization.errors.passwordsDontMatch);
            return;
        }
        setLocalError('');
        dispatch(
            onSendPasswordButtonClickedRequest({
                password,
            })
        );
    };

    const getErrorMessage = () => {
        if (localError) return localError;
        if (status === 'userExists') {
            return dictionary.authorization.errors.userExists;
        }
        if (status === 'userNotFound') {
            return dictionary.authorization.errors.userNotFound;
        }
        if (status === 'validationError') {
            return dictionary.authorization.errors.passwordSetError;
        }
        return '';
    };

    return (
        <div
            className="auth-modal"
            style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '30px 40px',
            }}
        >
            <Typography
                className="auth-header"
                color={colors.gray10}
                type="h2"
                text={dictionary.authorization.views.password}
            />
            <Typography
                color={colors.gray20}
                type="body"
                text={dictionary.authorization.views.passwordSubtitle}
                style={{ marginTop: '16px' }}
            />
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    marginTop: 16,
                }}
            >
                <Input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={dictionary.authorization.password}
                    type="password"
                    disabled={status === 'loading'}
                />
                <Input
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={dictionary.authorization.confirmPassword}
                    type="password"
                    disabled={status === 'loading'}
                />
                {getErrorMessage() && (
                    <Typography
                        color={colors.gray10}
                        type="body"
                        text={getErrorMessage()}
                    />
                )}
                <Button
                    classname="full-width"
                    title={dictionary.authorization.save}
                    color="blue"
                    rounded
                    type="rounded"
                    minimize={false}
                    onPress={handleSubmit}
                    disabled={status === 'loading'}
                />
            </div>
        </div>
    );
};

const SuccessView = () => {
    const dictionary = useSelector(useDictionary);
    const dispatch = useDispatch<AppDispatch>();

    return (
        <div
            className="auth-modal"
            style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '30px 40px',
            }}
        >
            <div style={{ textAlign: 'center' }}>
                <Typography
                    className="auth-header"
                    color={colors.gray10}
                    type="h2"
                    text={dictionary.authorization.views.success}
                />
                <Typography
                    color={colors.gray20}
                    type="body"
                    text={dictionary.authorization.views.successSubtitle}
                    style={{ marginTop: '16px' }}
                />
            </div>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    marginTop: 16,
                    alignItems: 'center',
                }}
            >
                <Button
                    classname="full-width"
                    title={dictionary.authorization.continue}
                    color="blue"
                    rounded
                    type="rounded"
                    minimize={false}
                    onPress={() => dispatch(setCurrentView('login'))}
                />
            </div>
        </div>
    );
};

export const AuthModal = () => {
    const currentView = useSelector(
        (state: StorageState) => state.auth.currentView
    );
    const dispatch = useDispatch<AppDispatch>();

    const renderView = () => {
        switch (currentView) {
            case 'login':
                return <LoginView />;
            case 'email':
                return <EmailView />;
            case 'code':
                return <CodeView />;
            case 'password':
                return <PasswordView />;
            case 'success':
                return <SuccessView />;
            default:
                return <></>;
        }
    };

    return (
        <Modal
            showModal={currentView !== 'closed'}
            onClose={() => {
                dispatch(onAuthClosedRequest());
            }}
        >
            {renderView()}
        </Modal>
    );
};
