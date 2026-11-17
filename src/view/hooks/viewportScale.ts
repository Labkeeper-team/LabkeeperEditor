import { Routes } from '../../viewModel/routes.ts';
import { MOBILE_BREAKPOINT } from './useMobile';
import { layoutViewportWidth } from '../utils/viewportSize';

export const VIEWPORT_RESCALE_EVENT = 'labkeeper:viewport-rescale';

/** Document-scrolled marketing page; must not force window scroll to 0. */
export function isTokensLandingPath() {
    return (
        window.location.pathname === Routes.Tokens ||
        window.location.pathname === Routes.Pay
    );
}

export function isNativeMobileLayoutPath() {
    const pathname = window.location.pathname;
    return (
        layoutViewportWidth() <= MOBILE_BREAKPOINT &&
        (pathname === Routes.Projects ||
            pathname === Routes.NewProject ||
            /^\/project\//.test(pathname))
    );
}

/**
 * Страница держит свою раскладку, а не уменьшается целиком до minWidth.
 * От планшета и шире так все страницы, на телефоне страницы приложения.
 * GH-266: раньше на 768–1023 вся страница уменьшалась до раскладки 1024,
 * текст мельчал, а под страницей оставалась чёрная полоса
 */
export function keepsOwnLayout() {
    return (
        isTokensLandingPath() ||
        layoutViewportWidth() > MOBILE_BREAKPOINT ||
        isNativeMobileLayoutPath()
    );
}
