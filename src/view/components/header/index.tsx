import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { Typography } from '../typography';
import { Button } from '../button';

import { HeaderLogo } from './logo';
import { InterfaceTour } from './tour';
import { ShareButton } from './share';
import { WikiButton } from './wiki';
import './style.scss';

import { Back } from './back';
import { useLocation } from 'react-router-dom';

import {
    useIsProjectReadonly,
    useUser,
} from '../../../viewModel/store/selectors/program';
import {
    useCurrentLanguage,
    useDictionary,
} from '../../../viewModel/store/selectors/translations';
import { setLanguage } from '../../../viewModel/store/slices/persistence';
import { Select } from '../select';
import { ProjectTitle } from './projectTitle';
import { Language } from '../../../viewModel/store/shared/dictionaries';
import { AuthModal } from '../../pages/project/auth';
import { ShareModal } from './share/modal';
import { ContactModal } from './contact/modal';
import { setShowContactModal } from '../../../viewModel/store/slices/settings';
import { AppDispatch } from '../../../viewModel/store';
import {
    onAuthButtonClickedRequest,
    onLogoutButtonClickedRequest,
} from '../../../controller';

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
    const { isAuthenticated, email } = useSelector(useUser);
    const projectIsReadonly = useSelector(useIsProjectReadonly);

    const onLoginClick = useCallback(async () => {
        dispatch(onAuthButtonClickedRequest());
    }, []);

    const onPress = (lang: unknown) => {
        dispatch(setLanguage(lang as Language));
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
                    <Button
                        title={dictionary.contact_modal.button}
                        rounded
                        classname="contact-us-button"
                        onPress={() => dispatch(setShowContactModal(true))}
                        minimize
                        color="inherit"
                    />
                </div>
                <div className="labkeeper_header__center">
                    <ProjectTitle />
                    {!projectIsReadonly && <ShareButton />}
                </div>
                <div className="labkeeper_header__right">
                    {location.pathname.startsWith('/project/') ? (
                        <InterfaceTour />
                    ) : null}
                    <WikiButton />
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
                    {isAuthenticated ? (
                        <Typography color="white" text={email} />
                    ) : null}
                    {isAuthenticated ? (
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                dispatch(onLogoutButtonClickedRequest());
                            }}
                        >
                            <Button
                                title={dictionary.exit}
                                rounded
                                classname="exit-button"
                                minimize
                                buttonType="submit"
                                color="inherit"
                            />
                        </form>
                    ) : null}
                </div>
            </div>
            <AuthModal />
            <ShareModal />
            <ContactModal />
        </>
    );
};
