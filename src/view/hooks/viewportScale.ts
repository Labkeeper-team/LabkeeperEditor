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
        (pathname === Routes.Projects || /^\/project\//.test(pathname))
    );
}
