import {Typography} from "../../../componenets/typography";
import {colors} from "../../../shared/styles/colors.ts";
import {Button} from "../../../componenets/button";
import {Login1Icon, Login2Icon} from "../../../shared/icons";
import {Modal} from "../../../shared/components/modal";
import {Routes} from "../../../routing/routes.ts";
import {useSelector} from "react-redux";
import {useDictionary} from "../../../store/selectors/translations.ts";
import {Input} from "../../../componenets/input";
import {useState, ChangeEvent} from "react";

export const AuthModal = ({showAuthModal, setShowAuthModal}) => {
    const dictionary = useSelector(useDictionary);
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const onPressYandexAuthClick = async () => {
        window.location = Routes.Login as any;
    }

    const handleLoginChange = (e: ChangeEvent<HTMLInputElement>) => {
        setLogin(e.target.value);
    };

    const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
        setPassword(e.target.value);
    };

    const onPressSimpleAuthClick = async () => {
        // Здесь будет логика проверки логина и пароля
        if (!login || !password) {
            setError('Пожалуйста, заполните все поля');
            return;
        }
        
        try {
            // Здесь должен быть запрос к API
            // Пока просто имитация ошибки
            setError('Неверный логин или пароль');
        } catch (e) {
            setError('Произошла ошибка при входе');
        }
    }

    return <Modal showModal={showAuthModal} onClose={() => setShowAuthModal(false)}>
        <div className='auth-modal' style={{display: 'flex', flexDirection: 'column', padding: '30px 40px'}}>
            <Typography className='auth-header' color={colors.gray10} type='h2' text={dictionary.authorization.title} />
            <div style={{display: 'flex', flexDirection: 'column', gap: 16, marginTop: 28}}>
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
                    onPress={onPressSimpleAuthClick}
                />
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
                <Button classname='full-width' title={dictionary.authorization.loginAndPasswoord} color='blue' rounded type='rounded' titleIcon={Login1Icon} minimize={false} onPress={onPressSimpleAuthClick}/>
            </div>
        </div>
    </Modal>
}