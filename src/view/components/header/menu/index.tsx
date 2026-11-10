import { useCallback, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';

import { controller } from '../../../../main.tsx';
import { Events } from '../../../../model/service/ObserverService.ts';
import { Routes } from '../../../../viewModel/routes.ts';
import { WikiLinks } from '../../../../viewModel/wiki.ts';
import { ExternalLinks } from '../../../../viewModel/externalLinks.ts';
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
import { Language, LANGUAGE_NAMES } from '../../../../viewModel/dictionaries';
import { useIsMobile } from '../../../hooks/useMobile';
import { DotssIcon } from '../../../icons';
import { LogoutConfirmModal } from '../logout-confirm-modal';

type HeaderMenuItem = {
    title: string;
    item: string;
    onClick: () => void;
    separatorAfter?: boolean;
};

const SITE_ORIGIN = window.location.origin;
const ABOUT_URL = `${SITE_ORIGIN}/about`;
// каталог шаблонов на лендинге, страница шаблона /templates/<slug>
const TEMPLATES_URL = `${SITE_ORIGIN}/templates`;

const LANGUAGE_OPTIONS: { label: string; value: Language }[] = (
    ['en', 'ru', 'zh'] as const
).map((value) => ({ label: LANGUAGE_NAMES[value], value }));

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
        matchPath(Routes.ProjectAgent, location.pathname) !== null ||
        location.pathname === Routes.ProjectDefault;

    const openExternal = useCallback((url: string) => {
        window.open(url, '_blank');
    }, []);

    const openWiki = useCallback(() => {
        openExternal(WikiLinks.home);
    }, [openExternal]);

    const openContactModal = useCallback(() => {
        controller.trackUiEvent(Events.EVENT_CONTACT_MODAL_OPENED);
        dispatch(setShowContactModal(true));
    }, [dispatch]);

    const openShareModal = useCallback(() => {
        controller.trackUiEvent(Events.EVENT_SHARE_MODAL_OPENED);
        dispatch(setShowShareModal(true));
    }, [dispatch]);

    const isProjectPage = location.pathname.startsWith('/project/');

    const languageMenuItems = useMemo((): HeaderMenuItem[] => {
        if (!isMobile) {
            return [];
        }

        return LANGUAGE_OPTIONS.filter(
            (option) => option.value !== language
        ).map((option) => ({
            title: dictionary.header_menu.change_language_to.replace(
                '{language}',
                option.label
            ),
            item: `language-${option.value}`,
            onClick: () => {
                controller.trackUiEvent(Events.EVENT_LANGUAGE_CHANGED, {
                    from: language,
                    to: option.value,
                });
                dispatch(setLanguage(option.value));
            },
        }));
    }, [
        dictionary.header_menu.change_language_to,
        dispatch,
        isMobile,
        language,
    ]);

    const withMobileLanguageItem = useCallback(
        (menuItems: HeaderMenuItem[]) => [...languageMenuItems, ...menuItems],
        [languageMenuItems]
    );

    const publicMenuItems: HeaderMenuItem[] = useMemo(
        () =>
            withMobileLanguageItem([
                {
                    title: dictionary.header_menu.templates,
                    item: 'templates',
                    onClick: () => openExternal(TEMPLATES_URL),
                },
                {
                    title: dictionary.header_menu.tokens,
                    item: 'tokens',
                    onClick: () => navigate(Routes.Tokens),
                },
                {
                    title: dictionary.wiki,
                    item: 'wiki',
                    onClick: openWiki,
                },
                // на настольной ширине та же ссылка уже висит иконкой в шапке
                ...(isMobile
                    ? [
                          {
                              title: dictionary.header_menu.github,
                              item: 'github',
                              onClick: () => openExternal(ExternalLinks.github),
                          },
                      ]
                    : []),
                {
                    title: dictionary.header_menu.about,
                    item: 'about',
                    onClick: () => openExternal(ABOUT_URL),
                },
                {
                    title: dictionary.header_menu.contact_us,
                    item: 'contact',
                    onClick: openContactModal,
                },
                ...(isEditorPage
                    ? [
                          {
                              title: dictionary.interface_tour.label,
                              item: 'tour',
                              onClick: () => dispatch(setTourVisibility(true)),
                          },
                      ]
                    : []),
            ]),
        [
            dictionary,
            dispatch,
            isEditorPage,
            isMobile,
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
                              item: 'projects',
                              onClick: () => navigate(Routes.Projects),
                          },
                      ]
                    : []),
                ...(isMobile && isProjectPage && !projectIsReadonly
                    ? [
                          {
                              title: dictionary.header_menu.share,
                              item: 'share',
                              onClick: openShareModal,
                          },
                      ]
                    : []),
                {
                    title: dictionary.header_menu.top_up_balance,
                    item: 'tokens',
                    onClick: () => navigate(Routes.Tokens),
                    separatorAfter: true,
                },
                ...(isEditorPage
                    ? [
                          {
                              title: dictionary.interface_tour.label,
                              item: 'tour',
                              onClick: () => dispatch(setTourVisibility(true)),
                          },
                      ]
                    : []),
                {
                    title: dictionary.header_menu.contact_us,
                    item: 'contact',
                    onClick: openContactModal,
                },
                {
                    title: dictionary.wiki,
                    item: 'wiki',
                    onClick: openWiki,
                },
                // на настольной ширине та же ссылка уже висит иконкой в шапке
                ...(isMobile
                    ? [
                          {
                              title: dictionary.header_menu.github,
                              item: 'github',
                              onClick: () => openExternal(ExternalLinks.github),
                          },
                      ]
                    : []),
                {
                    title: dictionary.header_menu.about,
                    item: 'about',
                    onClick: () => openExternal(ABOUT_URL),
                },
                {
                    title: dictionary.header_menu.templates,
                    item: 'templates',
                    onClick: () => openExternal(TEMPLATES_URL),
                    separatorAfter: true,
                },
                {
                    title: dictionary.header_menu.logout,
                    item: 'logout',
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

    // на страницах токенов и оплаты шапка своя, MarketingHeader, этого меню там нет
    const items = isAuthenticated ? authenticatedMenuItems : publicMenuItems;
    const useIconTrigger = isMobile;
    const showsEmailInTrigger = Boolean(
        !useIconTrigger && isAuthenticated && email
    );
    const triggerTitle = showsEmailInTrigger
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

        if (useIconTrigger && isAuthenticated) {
            const headerInfo: SelectItem[] = [
                ...(email
                    ? [
                          {
                              info: true as const,
                              label: email,
                              className: 'ym-hide-content',
                          },
                      ]
                    : []),
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
        isAuthenticated,
        items,
        tokenBalance,
        useIconTrigger,
    ]);

    const onMenuItemChange = (value: string | number) => {
        const item = items[Number(value)];
        if (!item) {
            return;
        }
        controller.trackUiEvent(Events.EVENT_MENU_ITEM_CLICKED, {
            item: item.item,
        });
        if (item.item === 'tour') {
            controller.trackUiEvent(Events.EVENT_TOUR_STARTED);
        }
        if (item.item === 'tokens') {
            controller.trackUiEvent(Events.EVENT_TOKENS_TOPUP_CLICKED, {
                source: 'menu',
            });
        }
        if (item.item === 'github') {
            controller.trackUiEvent(Events.EVENT_GITHUB_CLICKED, {
                source: 'menu',
            });
        }
        item.onClick();
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
                titleClassName={
                    showsEmailInTrigger ? 'ym-hide-content' : undefined
                }
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
