import { useLocation } from 'react-router-dom';

import { Routes } from '../../../viewModel/routes.ts';
import { AppHeader } from './app/AppHeader';
import { MarketingHeader } from './marketing/MarketingHeader';

export const Header = () => {
    const location = useLocation();

    if (location.pathname === Routes.Tokens) {
        return <MarketingHeader />;
    }

    return <AppHeader />;
};
