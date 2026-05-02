import { useDispatch, useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';

import { Button } from '../button';
import { HeaderLogo } from './logo';
import { ShareButton } from './share';
import './style.scss';

import { Back } from './back';

import { useIsProjectReadonly, useUser } from '../../store/selectors/program';
import {
    useCurrentLanguage,
    useDictionary,
} from '../../store/selectors/translations';
import { setLanguage } from '../../store/slices/persistence';
import { Select } from '../select';
import { ProjectTitle } from './projectTitle';
import { Language } from '../../../viewModel/dictionaries';
import { AuthModal } from '../../pages/project/auth';
import { ShareModal } from './share/modal';
import { AppDispatch } from '../../store';
import { HeaderMenu } from './menu';
import { controller } from '../../../main.tsx';
import { ContactModal } from './contact/modal';

const languageOptions = [
    {
        label: 'English',
        value: 'en',
    },
    {
        label: 'Русский',
        value: 'ru',
    },
];

export const Header = () => {
    const dispatch = useDispatch<AppDispatch>();
    const location = useLocation();
    const dictionary = useSelector(useDictionary);
    const language = useSelector(useCurrentLanguage);
    const { isAuthenticated } = useSelector(useUser);
    const projectIsReadonly = useSelector(useIsProjectReadonly);

    const onPress = (lang: unknown) => {
        dispatch(setLanguage(lang as Language));
    };

    const onLoginClick = () => {
        dispatch(controller.onAuthButtonClickedRequest());
    };

    return (
        <>
            <div className="labkeeper_header">
                <div className="labkeeper_header__left">
                    {location.pathname.startsWith('/project/') &&
                    !location.pathname.includes('default') ? (
                        <Back />
                    ) : null}
                    <HeaderLogo />
                    <div style={{ marginLeft: 20 }}>
                        <Select
                            options={languageOptions}
                            onChange={onPress}
                            value={language}
                        />
                    </div>
                </div>
                <div className="labkeeper_header__center">
                    <ProjectTitle />
                    {!projectIsReadonly && <ShareButton />}
                </div>
                <div className="labkeeper_header__right">
                    {/* {isAuthenticated ? (
                        <div className="header-tokens">
                            <span className="header-tokens__label">
                                {dictionary.header_menu.tokens}:{' '}
                                <span className="header-tokens__count">
                                    {tokens}
                                </span>
                            </span>
                            <button
                                className="header-tokens__add"
                                type="button"
                                onClick={() => navigate(Routes.Tokens)}
                                aria-label={
                                    dictionary.header_menu.top_up_balance
                                }
                            >
                                <span className="header-tokens__add-icon">
                                    +
                                </span>
                            </button>
                        </div>
                    ) : null} */}
                    {!isAuthenticated ? (
                        <Button
                            title={dictionary.login}
                            rounded
                            classname="login-button"
                            onPress={onLoginClick}
                            minimize
                            color="inherit"
                        />
                    ) : null}
                    <HeaderMenu />
                </div>
            </div>
            <AuthModal />
            <ShareModal />
            <ContactModal />
        </>
    );
};
