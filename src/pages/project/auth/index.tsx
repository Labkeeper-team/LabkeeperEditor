import {Typography} from "../../../componenets/typography";
import {colors} from "../../../shared/styles/colors.ts";
import {Button} from "../../../componenets/button";
import {Login1Icon, Login2Icon} from "../../../shared/icons";
import {Modal} from "../../../shared/components/modal";
import {Routes} from "../../../routing/routes.ts";
import {useSelector, useDispatch} from "react-redux";
import {useDictionary} from "../../../store/selectors/translations.ts";
import {Input} from "../../../componenets/input";
import {useState, ChangeEvent, useEffect} from "react";
import {
    setCurrentView,
    sendEmailWithCode,
    checkCode,
    setPassword as setPasswordAction,
    resetRequestStates,
    setRegistration, setShowAuthModal
} from "../../../store/slices/auth";
import {StorageState} from "../../../store";
import {AppDispatch} from "../../../store";

const LoginView = () => {
    const dictionary = useSelector(useDictionary);
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const dispatch = useDispatch();
    const error = useSelector((state: StorageState) => state.auth.authErrorMessage);

    const onPressYandexAuthClick = async () => {
        window.location = Routes.Login as any;
    }

    return <div style={{display: 'flex', flexDirection: 'column', gap: 16, marginTop: 28}}>
        <form method="POST" action="/formlogin" style={{display: 'flex', flexDirection: 'column', gap: 16}}>
            <Input
                value={login}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setLogin(e.target.value)}
                placeholder="Логин"
                type="text"
            />
            <Input
                value={password}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                placeholder="Пароль"
                type="password"
            />
            {error && (
                <Typography color={colors.gray10} type='body' text={error} />
            )}
            <Button
                classname='full-width'
                title="Войти"
                color='blue'
                rounded
                type='rounded'
                minimize={false}
                buttonType="submit"
            />
        </form>
        <div style={{display: 'flex', gap: 8, justifyContent: 'center', width: '100%'}}>
            <Button
                classname='full-width'
                title="Регистрация"
                color='blue'
                rounded
                type='rounded'
                minimize={true}
                onPress={() => {
                    dispatch(resetRequestStates());
                    dispatch(setRegistration(true))
                    dispatch(setCurrentView('email'));
                }}
            />
            <Button
                classname='full-width'
                title="Забыли пароль?"
                color='blue'
                rounded
                type='rounded'
                minimize={true}
                onPress={() => {
                    dispatch(resetRequestStates());
                    dispatch(setRegistration(false))
                    dispatch(setCurrentView('email'));
                }}
            />
        </div>
        <div style={{
            width: '100%',
            height: 1,
            backgroundColor: colors.gray40,
            margin: '8px 0'
        }} />
        <Button classname='full-width'
                title={`${dictionary.authorization.loginVia} @phystech.edu`}
                color='blue'
                rounded
                type='rounded'
                titleIcon={Login2Icon}
                minimize={false}
                onPress={onPressYandexAuthClick} />
        <div style={{display: 'flex', justifyContent: 'center', width: '100%'}}>
            <Typography color={colors.gray10} type='body-large' text={dictionary.or} />
        </div>
        <Button classname='full-width'
                title={dictionary.authorization.loginAndPasswoord}
                color='blue' rounded type='rounded'
                titleIcon={Login1Icon} minimize={false}
                onPress={onPressYandexAuthClick}/>
    </div>
}

const EmailView = () => {
    const [email, setEmail] = useState('');
    const dispatch = useDispatch<AppDispatch>();
    const status = useSelector((state: StorageState) => state.auth.emailRequest);

    useEffect(() => {
        if (status === 'ok') {
            dispatch(setCurrentView('code'))
        }
    }, [status]);

    const handleSubmit = async () => {
        if (!email) {
            return;
        }
        dispatch(sendEmailWithCode({ email }));
    }

    const getErrorMessage = () => {
        if (status === 'userExists') {
            return "Пользователь с таким email уже существует";
        }
        if (status === 'userNotFound') {
            return "Пользователь не найден";
        }
        if (status === 'validationError') {
            return "Неправильный формат почты";
        }
        return "";
    }

    return <div style={{display: 'flex', flexDirection: 'column', gap: 16, marginTop: 28}}>
        <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="text"
            disabled={status === 'loading'}
        />
        {getErrorMessage() && (
            <Typography color={colors.gray10} type='body' text={getErrorMessage()} />
        )}
        <Button
            classname='full-width'
            title="Отправить код"
            color='blue'
            rounded
            type='rounded'
            minimize={false}
            onPress={handleSubmit}
            disabled={status === 'loading'}
        />
    </div>
}

const CodeView = () => {
    const [code, setCode] = useState('');
    const dispatch = useDispatch<AppDispatch>();
    const status = useSelector((state: StorageState) => state.auth.codeCheckRequest);

    useEffect(() => {
        if (status === 'ok') {
            dispatch(setCurrentView('password'));
        }
    }, [status]);

    const handleSubmit = async () => {
        if (!code) {
            return;
        }
        dispatch(checkCode({ code }));
    }

    return <div style={{display: 'flex', flexDirection: 'column', gap: 16, marginTop: 28}}>
        <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Код подтверждения"
            type="text"
            disabled={status === 'loading'}
        />
        {status === 'invalid' && (
            <Typography color={colors.gray10} type='body' text="Неверный код подтверждения" />
        )}
        <Button
            classname='full-width'
            title="Подтвердить"
            color='blue'
            rounded
            type='rounded'
            minimize={false}
            onPress={handleSubmit}
            disabled={status === 'loading'}
        />
    </div>
}

const PasswordView = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [localError, setLocalError] = useState('');
    const dispatch = useDispatch<AppDispatch>();
    const status = useSelector((state: StorageState) => state.auth.passwordSetRequest);
    const currentEmail = useSelector((state: StorageState) => state.auth.currentEmail);
    const verifiedCode = useSelector((state: StorageState) => state.auth.lastVerifiedCode);

    useEffect(() => {
        if (status === 'ok') {
            dispatch(setCurrentView('login'))
        }
    }, [status]);

    const handleSubmit = async () => {
        if (!password || !confirmPassword || !currentEmail || !verifiedCode) {
            setLocalError('Пожалуйста, заполните все поля');
            return;
        }
        if (password !== confirmPassword) {
            setLocalError('Пароли не совпадают');
            return;
        }
        setLocalError('');
        dispatch(setPasswordAction({ 
            email: currentEmail, 
            code: verifiedCode,
            password
        }));
    }

    const getErrorMessage = () => {
        if (localError) return localError;
        if (status === 'userExists') {
            return "Пользователь с таким email уже существует";
        }
        if (status === 'userNotFound') {
            return "Пользователь не найден";
        }
        if (status === 'validationError') {
            return "Произошла ошибка при установке пароля";
        }
        return "";
    }

    return <div style={{display: 'flex', flexDirection: 'column', gap: 16, marginTop: 28}}>
        <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Новый пароль"
            type="password"
            disabled={status === 'loading'}
        />
        <Input
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Подтвердите пароль"
            type="password"
            disabled={status === 'loading'}
        />
        {getErrorMessage() && (
            <Typography color={colors.gray10} type='body' text={getErrorMessage()} />
        )}
        <Button
            classname='full-width'
            title="Сохранить"
            color='blue'
            rounded
            type='rounded'
            minimize={false}
            onPress={handleSubmit}
            disabled={status === 'loading'}
        />
    </div>
}

export const AuthModal = () => {
    const dictionary = useSelector(useDictionary);
    const currentView = useSelector((state: StorageState) => state.auth.currentView);
    const dispatch = useDispatch();
    const showAuthModal = useSelector((state: StorageState) => state.auth.showAuthModal);

    useEffect(() => {
        if (showAuthModal) {
            dispatch(resetRequestStates());
            dispatch(setCurrentView('login'));
        }
    }, [showAuthModal]);

    const renderView = () => {
        switch (currentView) {
            case 'login':
                return <LoginView />;
            case 'email':
                return <EmailView/>;
            case 'code':
                return <CodeView />;
            case 'password':
                return <PasswordView/>;
            default:
                return <LoginView />;
        }
    }

    return <Modal showModal={showAuthModal} onClose={() => {
        dispatch(setShowAuthModal(false));
        dispatch(resetRequestStates());
    }}>
        <div className='auth-modal' style={{display: 'flex', flexDirection: 'column', padding: '30px 40px'}}>
            <Typography className='auth-header' color={colors.gray10} type='h2' text={dictionary.authorization.title} />
            {renderView()}
        </div>
    </Modal>
}