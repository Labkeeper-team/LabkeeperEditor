import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';

import marketingLogoMark from '../../../assets/marketing-footer-logo-mark.svg';
import { useUser } from '../../../store/selectors/program';
import {
    useCurrentLanguage,
    useDictionary,
} from '../../../store/selectors/translations';
import { setLanguage } from '../../../store/slices/persistence';
import { AppDispatch } from '../../../store';
import { AuthModal } from '../../../pages/project/auth';
import { ShareModal } from '../share/modal';
import { ContactModal } from '../contact/modal';
import { controller } from '../../../../main.tsx';
import { Language } from '../../../../viewModel/dictionaries';
import { Routes } from '../../../../viewModel/routes.ts';
import { LogoutConfirmModal } from '../logout-confirm-modal';
import { MarketingHeaderLang } from './MarketingHeaderLang';
import './style.scss';

export const MarketingHeader = () => {
    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();
    const location = useLocation();
    const dictionary = useSelector(useDictionary);
    const language = useSelector(useCurrentLanguage);
    const { isAuthenticated, tokens } = useSelector(useUser);
    const [menuIsOpen, setMenuIsOpen] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false);

    const onLoginClick = () => {
        dispatch(controller.onAuthButtonClickedRequest());
    };

    const confirmLogout = () => {
        setShowLogoutModal(false);
        dispatch(controller.onLogoutButtonClickedRequest());
    };

    const openLogoutModal = () => {
        setMenuIsOpen(false);
        setShowLogoutModal(true);
    };

    const closeMenuAndRun = (action: () => void) => {
        setMenuIsOpen(false);
        action();
    };

    const onAnchorNav = (anchor: string) => {
        window.location.href = `https://labkeeper.io/#${anchor}`;
    };

    const onAboutNav = () => {
        window.location.href = 'https://labkeeper.io/about';
    };

    const onLanguageSelect = (lang: Language) => {
        dispatch(setLanguage(lang));
    };

    const isTokensRoute = location.pathname === Routes.Tokens;
    const navItems = [
        {
            title: dictionary.tokens_page.navigation.advantages,
            action: () => onAnchorNav('features'),
            isActive: false,
        },
        {
            title: dictionary.tokens_page.navigation.features,
            action: () => onAnchorNav('advantages'),
            isActive: false,
        },
        {
            title: dictionary.tokens_page.navigation.for_whom,
            action: () => onAnchorNav('audience'),
            isActive: false,
        },
        {
            title: dictionary.tokens_page.navigation.examples,
            action: () => onAnchorNav('examples'),
            isActive: false,
        },
        {
            title: dictionary.tokens_page.navigation.tokens,
            action: () => navigate(Routes.Tokens),
            isActive: isTokensRoute,
        },
        {
            title: dictionary.tokens_page.navigation.about,
            action: onAboutNav,
            isActive: false,
        },
    ];
    return (
        <>
            <header className="marketing-header">
                <div className="marketing-header__container">
                    <div className="marketing-header__left">
                        <button
                            className={`marketing-header__burger${
                                menuIsOpen
                                    ? ' marketing-header__burger--active'
                                    : ''
                            }`}
                            type="button"
                            aria-label={dictionary.header_menu.menu}
                            aria-expanded={menuIsOpen}
                            onClick={() => setMenuIsOpen((current) => !current)}
                        >
                            <span className="marketing-header__burger-line" />
                            <span className="marketing-header__burger-line" />
                            <span className="marketing-header__burger-line" />
                        </button>
                        <button
                            className="marketing-header__logo"
                            type="button"
                            onClick={() =>
                                closeMenuAndRun(() => navigate(Routes.Home))
                            }
                        >
                            <img
                                src={marketingLogoMark}
                                alt=""
                                className="marketing-header__logo-icon"
                                width={36}
                                height={36}
                            />
                            <span className="marketing-header__logo-text">
                                Labkeeper
                            </span>
                        </button>
                        <MarketingHeaderLang
                            language={language}
                            onSelect={onLanguageSelect}
                            wrapperClassName="marketing-header__lang"
                        />
                    </div>
                    <nav
                        className={`marketing-header__nav${
                            menuIsOpen ? ' marketing-header__nav--open' : ''
                        }`}
                    >
                        <MarketingHeaderLang
                            language={language}
                            onSelect={onLanguageSelect}
                            wrapperClassName="marketing-header__mobile-lang"
                        />
                        <ul className="marketing-header__nav-list">
                            {navItems.map((item) => (
                                <li
                                    className={`marketing-header__nav-item${
                                        item.isActive
                                            ? ' marketing-header__nav-item--active'
                                            : ''
                                    }`}
                                    key={item.title}
                                >
                                    <button
                                        className={`marketing-header__nav-link${
                                            item.isActive
                                                ? ' marketing-header__nav-link--active'
                                                : ''
                                        }`}
                                        type="button"
                                        onClick={() =>
                                            closeMenuAndRun(item.action)
                                        }
                                    >
                                        {item.title}
                                    </button>
                                </li>
                            ))}
                        </ul>
                        <div className="marketing-header__mobile-actions">
                            {isAuthenticated ? (
                                <div className="marketing-header__tokens marketing-header__tokens--mobile">
                                    <span>{dictionary.header_menu.tokens}</span>
                                    <strong>{tokens}</strong>
                                </div>
                            ) : null}
                            {isAuthenticated ? (
                                <button
                                    className="marketing-header__auth-link marketing-header__auth-link--accent"
                                    type="button"
                                    onClick={() =>
                                        closeMenuAndRun(() =>
                                            navigate(Routes.Projects)
                                        )
                                    }
                                >
                                    {dictionary.tokens_page.navigation.projects}
                                </button>
                            ) : null}
                            <button
                                className="marketing-header__auth-link marketing-header__auth-link--accent"
                                type="button"
                                onClick={() =>
                                    closeMenuAndRun(() =>
                                        navigate(Routes.ProjectDefault)
                                    )
                                }
                            >
                                {dictionary.tokens_page.navigation.editor}
                            </button>
                            {isAuthenticated ? (
                                <>
                                    <span
                                        className="marketing-header__separator"
                                        aria-hidden
                                    />
                                    <button
                                        className="marketing-header__auth-link"
                                        type="button"
                                        onClick={openLogoutModal}
                                    >
                                        {
                                            dictionary.tokens_page.navigation
                                                .logout
                                        }
                                    </button>
                                </>
                            ) : (
                                <>
                                    <span
                                        className="marketing-header__separator"
                                        aria-hidden
                                    />
                                    <button
                                        className="marketing-header__auth-link"
                                        type="button"
                                        onClick={() =>
                                            closeMenuAndRun(onLoginClick)
                                        }
                                    >
                                        {dictionary.tokens_page.navigation.login}
                                    </button>
                                </>
                            )}
                        </div>
                        <div className="marketing-header__mobile-contact">
                            <span className="marketing-header__mobile-contact-label">
                                {dictionary.header_menu.contact_us}
                            </span>
                            <a
                                className="marketing-header__mobile-contact-link"
                                href="mailto:contact@labkeeper.io"
                            >
                                contact@labkeeper.io
                            </a>
                        </div>
                    </nav>
                    <div className="marketing-header__right">
                        {isAuthenticated ? (
                            <button
                                className="marketing-header__auth-link marketing-header__auth-link--accent"
                                type="button"
                                onClick={() =>
                                    closeMenuAndRun(() =>
                                        navigate(Routes.Projects)
                                    )
                                }
                            >
                                {dictionary.tokens_page.navigation.projects}
                            </button>
                        ) : null}
                        <button
                            className="marketing-header__auth-link marketing-header__auth-link--accent"
                            type="button"
                            onClick={() =>
                                closeMenuAndRun(() =>
                                    navigate(Routes.ProjectDefault)
                                )
                            }
                        >
                            {dictionary.tokens_page.navigation.editor}
                        </button>
                        {isAuthenticated ? (
                            <>
                                <span
                                    className="marketing-header__separator"
                                    aria-hidden
                                />
                                <button
                                    className="marketing-header__auth-link"
                                    type="button"
                                    onClick={openLogoutModal}
                                >
                                    {dictionary.tokens_page.navigation.logout}
                                </button>
                            </>
                        ) : (
                            <>
                                <span
                                    className="marketing-header__separator"
                                    aria-hidden
                                />
                                <button
                                    className="marketing-header__auth-link"
                                    type="button"
                                    onClick={() => closeMenuAndRun(onLoginClick)}
                                >
                                    {dictionary.tokens_page.navigation.login}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </header>
            <AuthModal />
            <ShareModal />
            <ContactModal />
            <LogoutConfirmModal
                open={showLogoutModal}
                onClose={() => setShowLogoutModal(false)}
                onConfirm={confirmLogout}
            />
        </>
    );
};
