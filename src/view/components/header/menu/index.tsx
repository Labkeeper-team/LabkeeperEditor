import { useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { controller } from '../../../../main.tsx';
import { Routes } from '../../../../viewModel/routes.ts';
import { Select } from '../../select';
import { SelectItem } from '../../select/model.ts';
import { useUser } from '../../../store/selectors/program';
import {
    useCurrentLanguage,
    useDictionary,
} from '../../../store/selectors/translations';
import { AppDispatch } from '../../../store';
import {
    setShowContactModal,
    setTourVisibility,
} from '../../../store/slices/settings';
import { Modal } from '../../modal';
import { Typography } from '../../typography';
import { colors } from '../../../styles/colors';
import { Button } from '../../button';

import './style.scss';

type HeaderMenuItem = {
    title: string;
    onClick: () => void;
    separatorAfter?: boolean;
};

const SITE_ORIGIN = window.location.origin;
const ABOUT_URL = `${SITE_ORIGIN}/about`;
const EXAMPLES_URL = `${SITE_ORIGIN}/#examples`;
const WIKI_URL = 'https://github.com/Labkeeper-team/Docs/wiki/';

export const HeaderMenu = () => {
    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();
    const dictionary = useSelector(useDictionary);
    const language = useSelector(useCurrentLanguage);
    const { isAuthenticated, email } = useSelector(useUser);
    const [showLogoutModal, setShowLogoutModal] = useState(false);

    const openExternal = useCallback((url: string) => {
        window.open(url, '_blank');
    }, []);

    const openWiki = useCallback(() => {
        openExternal(WIKI_URL + language);
    }, [language, openExternal]);

    const openContactModal = useCallback(() => {
        dispatch(setShowContactModal(true));
    }, [dispatch]);

    const publicMenuItems: HeaderMenuItem[] = [
        {
            title: dictionary.header_menu.examples,
            onClick: () => openExternal(EXAMPLES_URL),
        },
        // TODO tokens
        // {
        //     title: dictionary.header_menu.privacy_policy,
        //     onClick: () => openExternal(SITE_ORIGIN),
        // },
        // {
        //     title: dictionary.header_menu.tokens,
        //     onClick: () => navigate(Routes.Tokens),
        // },
        {
            title: dictionary.header_menu.about,
            onClick: () => openExternal(ABOUT_URL),
        },
    ];

    const authenticatedMenuItems: HeaderMenuItem[] = [
        {
            title: dictionary.header_menu.my_projects,
            onClick: () => navigate(Routes.Projects),
            separatorAfter: true,
        },
        // TODO tokens
        // {
        //     title: dictionary.header_menu.top_up_balance,
        //     onClick: () => navigate(Routes.Tokens),
        //     separatorAfter: true,
        // },
        {
            title: dictionary.interface_tour.label,
            onClick: () => dispatch(setTourVisibility(true)),
        },
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
        /*
        TODO tokens
        {
            title: dictionary.header_menu.privacy_policy,
            onClick: () => openExternal(LABKEEPER_URL),
            separatorAfter: true,
        },*/
        {
            title: dictionary.header_menu.logout,
            onClick: () => setShowLogoutModal(true),
        },
    ];

    const items = isAuthenticated ? authenticatedMenuItems : publicMenuItems;
    const triggerTitle =
        isAuthenticated && email ? email : dictionary.header_menu.menu;
    const options = items.flatMap((item, index): SelectItem[] => {
        const option = {
            label: item.title,
            value: index,
        };

        return item.separatorAfter ? [option, { separator: true }] : [option];
    });

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
            />
            <Modal
                showModal={showLogoutModal}
                onClose={() => setShowLogoutModal(false)}
            >
                <div className="header-menu-logout-modal">
                    <Typography
                        text={dictionary.header_menu.logout_confirmation}
                        type="h2"
                        color={colors.gray10}
                    />
                    <Button
                        classname="header-menu-logout-modal__button"
                        onPress={confirmLogout}
                        title={dictionary.yes}
                        color="blue"
                        rounded
                        minimize={false}
                    />
                    <Button
                        classname="header-menu-logout-modal__button"
                        onPress={() => setShowLogoutModal(false)}
                        title={dictionary.no}
                        color="gray"
                        rounded
                        minimize={false}
                    />
                </div>
            </Modal>
        </>
    );
};
