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
import {setCurrentView} from "../../../store/slices/auth";
import {StorageState} from "../../../store";

const LoginView = () => {
    const dictionary = useSelector(useDictionary);
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const dispatch = useDispatch();

    const onPressYandexAuthClick = async () => {
        window.location = Routes.Login as any;
    }

    const handleLoginChange = (e: ChangeEvent<HTMLInputElement>) => {
        setLogin(e.target.value);
    };

    const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
        setPassword(e.target.value);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!login || !password) {
            setError('Пожалуйста, заполните все поля');
            return;
        }

        try {
            // Здесь должен быть запрос к API
            setError('Неверный логин или пароль');
        } catch (e) {
            setError('Произошла ошибка при входе');
        }
    }

    return <div style={{display: 'flex', flexDirection: 'column', gap: 16, marginTop: 28}}>
        <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', gap: 16}}>
            <Input
                value={login}
                onChange={handleLoginChange}
                placeholder="Логин"
                type="text"
            />
            <Input
                value={password}
                onChange={handlePasswordChange}
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
                minimize={false}
                onPress={() => dispatch(setCurrentView('email'))}
            />
            <Button
                classname='full-width'
                title="Забыли пароль?"
                color='blue'
                rounded
                type='rounded'
                minimize={false}
                onPress={() => dispatch(setCurrentView('email'))}
            />
        </div>
        <div style={{
            width: '100%',
            height: 1,
            backgroundColor: colors.gray40,
            margin: '8px 0'
        }} />
        <Button classname='full-width' title={`${dictionary.authorization.loginVia} @phystech.edu`} color='blue' rounded type='rounded' titleIcon={Login2Icon} minimize={false} onPress={onPressYandexAuthClick} />
        <div style={{display: 'flex', justifyContent: 'center', width: '100%'}}>
            <Typography color={colors.gray10} type='body-large' text={dictionary.or} />
        </div>
        <form onSubmit={handleSubmit}>
            <Button classname='full-width' title={dictionary.authorization.loginAndPasswoord} color='blue' rounded type='rounded' titleIcon={Login1Icon} minimize={false} buttonType="submit"/>
        </form>
    </div>
}

const EmailView = () => {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const dispatch = useDispatch();

    const handleSubmit = async () => {
        if (!email) {
            setError('Пожалуйста, введите email');
            return;
        }
        try {
            // Здесь должен быть запрос к API для отправки кода
            dispatch(setCurrentView('code'));
        } catch (e) {
            setError('Произошла ошибка при отправке кода');
        }
    }

    return <div style={{display: 'flex', flexDirection: 'column', gap: 16, marginTop: 28}}>
        <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="text"
        />
        {error && (
            <Typography color={colors.gray10} type='body' text={error} />
        )}
        <Button
            classname='full-width'
            title="Отправить код"
            color='blue'
            rounded
            type='rounded'
            minimize={false}
            onPress={handleSubmit}
        />
    </div>
}

const CodeView = () => {
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const dispatch = useDispatch();

    const handleSubmit = async () => {
        if (!code) {
            setError('Пожалуйста, введите код');
            return;
        }
        try {
            // Здесь должен быть запрос к API для проверки кода
            dispatch(setCurrentView('password'));
        } catch (e) {
            setError('Неверный код подтверждения');
        }
    }

    return <div style={{display: 'flex', flexDirection: 'column', gap: 16, marginTop: 28}}>
        <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Код подтверждения"
            type="text"
        />
        {error && (
            <Typography color={colors.gray10} type='body' text={error} />
        )}
        <Button
            classname='full-width'
            title="Подтвердить"
            color='blue'
            rounded
            type='rounded'
            minimize={false}
            onPress={handleSubmit}
        />
    </div>
}

const PasswordView = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const dispatch = useDispatch();

    const handleSubmit = async () => {
        if (!password || !confirmPassword) {
            setError('Пожалуйста, заполните все поля');
            return;
        }
        if (password !== confirmPassword) {
            setError('Пароли не совпадают');
            return;
        }
        try {
            // Здесь должен быть запрос к API для установки пароля
            dispatch(setCurrentView('login'));
        } catch (e) {
            setError('Произошла ошибка при установке пароля');
        }
    }

    return <div style={{display: 'flex', flexDirection: 'column', gap: 16, marginTop: 28}}>
        <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Новый пароль"
            type="password"
        />
        <Input
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Подтвердите пароль"
            type="password"
        />
        {error && (
            <Typography color={colors.gray10} type='body' text={error} />
        )}
        <Button
            classname='full-width'
            title="Сохранить"
            color='blue'
            rounded
            type='rounded'
            minimize={false}
            onPress={handleSubmit}
        />
    </div>
}

export const AuthModal = ({showAuthModal, setShowAuthModal}) => {
    const dictionary = useSelector(useDictionary);
    const currentView = useSelector((state: StorageState) => state.auth.currentView);
    const dispatch = useDispatch();

    useEffect(() => {
        if (showAuthModal) {
            dispatch(setCurrentView('login'));
        }
    }, [showAuthModal]);

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
            default:
                return <LoginView />;
        }
    }

    return <Modal showModal={showAuthModal} onClose={() => setShowAuthModal(false)}>
        <div className='auth-modal' style={{display: 'flex', flexDirection: 'column', padding: '30px 40px'}}>
            <Typography className='auth-header' color={colors.gray10} type='h2' text={dictionary.authorization.title} />
            {renderView()}
        </div>
    </Modal>
}