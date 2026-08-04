import { useCallback, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';

import { controller } from '../../../../main.tsx';
import { Routes } from '../../../../viewModel/routes.ts';
import { Select } from '../../select';
import { SelectItem } from '../../select/model.ts';
import {
    useUser,
    useIsProjectReadonly,
} from '../../../store/selectors/program';
import {
    useCurrentLanguage,
    useDictionary,
} from '../../../store/selectors/translations';
import { AppDispatch } from '../../../store';
import {
    setShowContactModal,
    setShowShareModal,
    setTourVisibility,
} from '../../../store/slices/settings';
import { setLanguage } from '../../../store/slices/persistence';
import { Language } from '../../../../viewModel/dictionaries';
import { useIsMobile } from '../../../hooks/useMobile';
import { DotssIcon } from '../../../icons';
import { LogoutConfirmModal } from '../logout-confirm-modal';

type HeaderMenuItem = {
    title: string;
    onClick: () => void;
    separatorAfter?: boolean;
};

const SITE_ORIGIN = window.location.origin;
const ABOUT_URL = `${SITE_ORIGIN}/about`;
const EXAMPLES_URL = `${SITE_ORIGIN}/#examples`;
const WIKI_URL = 'https://github.com/Labkeeper-team/Docs/wiki/';

const LANGUAGE_OPTIONS: { label: string; value: Language }[] = [
    { label: 'English', value: 'en' },
    { label: 'Русский', value: 'ru' },
];

export const HeaderMenu = () => {
    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();
    const location = useLocation();
    const dictionary = useSelector(useDictionary);
    const language = useSelector(useCurrentLanguage);
    const { isAuthenticated, email, tokenBalance } = useSelector(useUser);
    const projectIsReadonly = useSelector(useIsProjectReadonly);
    const isMobile = useIsMobile();
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const isEditorPage =
        matchPath(Routes.Project, location.pathname) !== null ||
        location.pathname === Routes.ProjectDefault;

    const openExternal = useCallback((url: string) => {
        window.open(url, '_blank');
    }, []);

    const openWiki = useCallback(() => {
        openExternal(WIKI_URL + language);
    }, [language, openExternal]);

    const openContactModal = useCallback(() => {
        dispatch(setShowContactModal(true));
    }, [dispatch]);

    const openShareModal = useCallback(() => {
        dispatch(setShowShareModal(true));
    }, [dispatch]);

    const openAuthModal = useCallback(() => {
        dispatch(controller.onAuthButtonClickedRequest());
    }, [dispatch]);

    const openLandingAnchor = useCallback(
        (anchor: string) => {
            openExternal(`${SITE_ORIGIN}/#${anchor}`);
        },
        [openExternal]
    );

    const isProjectPage = location.pathname.startsWith('/project/');

    const alternateLanguage = LANGUAGE_OPTIONS.find(
        (option) => option.value !== language
    );

    const languageMenuItem = useMemo((): HeaderMenuItem | null => {
        if (!isMobile || !alternateLanguage) {
            return null;
        }

        return {
            title: dictionary.header_menu.change_language_to.replace(
                '{language}',
                alternateLanguage.label
            ),
            onClick: () => dispatch(setLanguage(alternateLanguage.value)),
        };
    }, [
        alternateLanguage,
        dictionary.header_menu.change_language_to,
        dispatch,
        isMobile,
    ]);

    const withMobileLanguageItem = useCallback(
        (menuItems: HeaderMenuItem[]) =>
            languageMenuItem ? [languageMenuItem, ...menuItems] : menuItems,
        [languageMenuItem]
    );

    const publicMenuItems: HeaderMenuItem[] = useMemo(
        () =>
            withMobileLanguageItem([
                {
                    title: dictionary.header_menu.examples,
                    onClick: () => openExternal(EXAMPLES_URL),
                },
                {
                    title: dictionary.header_menu.tokens,
                    onClick: () => navigate(Routes.Tokens),
                },
                {
                    title: dictionary.wiki,
                    onClick: openWiki,
                },
                {
                    title: dictionary.header_menu.about,
                    onClick: () => openExternal(ABOUT_URL),
                },
                {
                    title: dictionary.header_menu.contact_us,
                    onClick: openContactModal,
                },
                ...(isEditorPage
                    ? [
                          {
                              title: dictionary.interface_tour.label,
                              onClick: () => dispatch(setTourVisibility(true)),
                          },
                      ]
                    : []),
            ]),
        [
            dictionary,
            dispatch,
            isEditorPage,
            navigate,
            openContactModal,
            openExternal,
            openWiki,
            withMobileLanguageItem,
        ]
    );

    const authenticatedMenuItems: HeaderMenuItem[] = useMemo(
        () =>
            withMobileLanguageItem([
                ...(isProjectPage
                    ? [
                          {
                              title: dictionary.header_menu.my_projects,
                              onClick: () => navigate(Routes.Projects),
                          },
                      ]
                    : []),
                ...(isMobile && isProjectPage && !projectIsReadonly
                    ? [
                          {
                              title: dictionary.header_menu.share,
                              onClick: openShareModal,
                          },
                      ]
                    : []),
                {
                    title: dictionary.header_menu.top_up_balance,
                    onClick: () => navigate(Routes.Tokens),
                    separatorAfter: true,
                },
                ...(isEditorPage
                    ? [
                          {
                              title: dictionary.interface_tour.label,
                              onClick: () => dispatch(setTourVisibility(true)),
                          },
                      ]
                    : []),
                {
                    title: dictionary.header_menu.contact_us,
                    onClick: openContactModal,
                },
                {
                    title: dictionary.wiki,
                    onClick: openWiki,
                },
                {
                    title: dictionary.header_menu.about,
                    onClick: () => openExternal(ABOUT_URL),
                },
                {
                    title: dictionary.header_menu.examples,
                    onClick: () => openExternal(EXAMPLES_URL),
                    separatorAfter: true,
                },
                {
                    title: dictionary.header_menu.logout,
                    onClick: () => setShowLogoutModal(true),
                },
            ]),
        [
            dictionary,
            dispatch,
            isEditorPage,
            isMobile,
            isProjectPage,
            navigate,
            openContactModal,
            openExternal,
            openShareModal,
            openWiki,
            projectIsReadonly,
            withMobileLanguageItem,
        ]
    );

    const tokensPageMenuItems: HeaderMenuItem[] = useMemo(
        () =>
            withMobileLanguageItem([
                {
                    title: dictionary.tokens_page.navigation.advantages,
                    onClick: () => openLandingAnchor('advantages'),
                },
                {
                    title: dictionary.tokens_page.navigation.features,
                    onClick: () => openLandingAnchor('features'),
                },
                {
                    title: dictionary.tokens_page.navigation.for_whom,
                    onClick: () => openLandingAnchor('for-whom'),
                },
                {
                    title: dictionary.tokens_page.navigation.examples,
                    onClick: () => openLandingAnchor('examples'),
                },
                {
                    title: dictionary.tokens_page.navigation.tokens,
                    onClick: () => navigate(Routes.Tokens),
                },
                {
                    title: dictionary.tokens_page.navigation.about,
                    onClick: () => openExternal(ABOUT_URL),
                    separatorAfter: true,
                },
                ...(isAuthenticated
                    ? [
                          {
                              title: dictionary.tokens_page.navigation.logout,
                              onClick: () => setShowLogoutModal(true),
                          },
                      ]
                    : [
                          {
                              title: dictionary.tokens_page.navigation.login,
                              onClick: openAuthModal,
                          },
                      ]),
                {
                    title: dictionary.tokens_page.navigation.editor,
                    onClick: () =>
                        dispatch(
                            controller.onOpenEditorAfterSpaNavigationRequest()
                        ),
                },
                ...(isAuthenticated
                    ? [
                          {
                              title: dictionary.tokens_page.navigation.projects,
                              onClick: () => navigate(Routes.Projects),
                          },
                      ]
                    : []),
            ]),
        [
            dictionary,
            dispatch,
            isAuthenticated,
            navigate,
            openAuthModal,
            openExternal,
            openLandingAnchor,
            withMobileLanguageItem,
        ]
    );

    const isTokensPage = location.pathname === Routes.Tokens;
    const items = isTokensPage
        ? tokensPageMenuItems
        : isAuthenticated
          ? authenticatedMenuItems
          : publicMenuItems;
    const useIconTrigger = isMobile && isAuthenticated;
    const triggerTitle = useIconTrigger
        ? dictionary.header_menu.menu
        : isAuthenticated && email
          ? email
          : dictionary.header_menu.menu;

    const options = useMemo((): SelectItem[] => {
        const menuOptions = items.flatMap((item, index): SelectItem[] => {
            const option = {
                label: item.title,
                value: index,
            };

            return item.separatorAfter
                ? [option, { separator: true }]
                : [option];
        });

        if (useIconTrigger) {
            const headerInfo: SelectItem[] = [
                ...(email ? [{ info: true as const, label: email }] : []),
                {
                    info: true as const,
                    label: `${dictionary.header_menu.tokens}: ${tokenBalance}`,
                },
                { separator: true },
            ];

            return [...headerInfo, ...menuOptions];
        }

        return menuOptions;
    }, [
        dictionary.header_menu.tokens,
        email,
        items,
        tokenBalance,
        useIconTrigger,
    ]);

    const onMenuItemChange = (value: string | number) => {
        items[Number(value)]?.onClick();
    };

    const confirmLogout = () => {
        setShowLogoutModal(false);
        dispatch(controller.onLogoutButtonClickedRequest());
    };

    return (
        <>
            <Select
                options={options}
                onChange={onMenuItemChange}
                value=""
                title={triggerTitle}
                containerClassName="header-menu-select"
                fitToOptionsWidth
                triggerContent={
                    useIconTrigger ? <DotssIcon aria-hidden /> : undefined
                }
            />
            <LogoutConfirmModal
                open={showLogoutModal}
                onClose={() => setShowLogoutModal(false)}
                onConfirm={confirmLogout}
            />
        </>
    );
};
