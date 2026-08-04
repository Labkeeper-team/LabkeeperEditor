import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';

import { Button } from '../../button';
import { HeaderLogo } from '../logo';
import { ShareButton } from '../share';
import { Back } from '../back';
import {
    useIsProjectReadonly,
    useUser,
} from '../../../store/selectors/program';
import {
    useCurrentLanguage,
    useDictionary,
} from '../../../store/selectors/translations';
import { setLanguage } from '../../../store/slices/persistence';
import { Select } from '../../select';
import { ProjectTitle } from '../projectTitle';
import { Language } from '../../../../viewModel/dictionaries';
import { AuthModal } from '../../../pages/project/auth';
import { ShareModal } from '../share/modal';
import { AppDispatch } from '../../../store';
import { HeaderMenu } from '../menu';
import { controller } from '../../../../main.tsx';
import { ContactModal } from '../contact/modal';
import { Routes } from '../../../../viewModel/routes.ts';
import { MobileViewSwitcher } from '../mobileViewSwitcher';
import { useIsMobile } from '../../../hooks/useMobile';

import '../style.scss';
import { PrivacyPolicyAcceptanceModal } from '../../../pages/project/modals/privacy-policy-acceptance';

const languageOptions = [
    { label: 'English', value: 'en' },
    { label: 'Русский', value: 'ru' },
];

export const AppHeader = () => {
    const dispatch = useDispatch<AppDispatch>();
    const location = useLocation();
    const navigate = useNavigate();
    const dictionary = useSelector(useDictionary);
    const language = useSelector(useCurrentLanguage);
    const { isAuthenticated, tokenBalance } = useSelector(useUser);
    const projectIsReadonly = useSelector(useIsProjectReadonly);
    const isMobile = useIsMobile();

    const isProjectPage = location.pathname.startsWith('/project/');
    const showMobileViewSwitcher = isProjectPage && isMobile;

    const onLanguageChange = (lang: unknown) => {
        dispatch(setLanguage(lang as Language));
    };

    const onLoginClick = () => {
        dispatch(controller.onAuthButtonClickedRequest());
    };

    return (
        <>
            <div className="labkeeper_header-shell">
                <div className="labkeeper_header">
                    <div className="labkeeper_header__left">
                        {isProjectPage &&
                        !location.pathname.includes('default') ? (
                            <Back />
                        ) : null}
                        <HeaderLogo />
                        {!isMobile ? (
                            <div className="labkeeper_header__language">
                                <Select
                                    options={languageOptions}
                                    onChange={onLanguageChange}
                                    value={language}
                                />
                            </div>
                        ) : null}
                    </div>
                    <div className="labkeeper_header__center">
                        <ProjectTitle />
                        {!projectIsReadonly && !isMobile ? (
                            <ShareButton />
                        ) : null}
                    </div>
                    <div className="labkeeper_header__right">
                        {isAuthenticated && !isMobile ? (
                            <div className="header-tokens">
                                <span className="header-tokens__label">
                                    {dictionary.header_menu.tokens}:{' '}
                                    <span className="header-tokens__count">
                                        {tokenBalance}
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
                        ) : null}
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
                {showMobileViewSwitcher ? <MobileViewSwitcher /> : null}
            </div>
            <AuthModal />
            <ShareModal />
            <ContactModal />
            <PrivacyPolicyAcceptanceModal />
        </>
    );
};
