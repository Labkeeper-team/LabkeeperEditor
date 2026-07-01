import { MobileProjectPanel } from '../../../store/slices/index.ts';

export const MOBILE_BREAKPOINT = 1024;
export const AUTHORIZED_MOBILE_PANELS: MobileProjectPanel[] = [
    'files',
    'editor',
    'viewer',
];
export const GUEST_MOBILE_PANELS: MobileProjectPanel[] = ['editor', 'viewer'];

export const getAvailableMobilePanels = (isAuthenticated: boolean) =>
    isAuthenticated ? AUTHORIZED_MOBILE_PANELS : GUEST_MOBILE_PANELS;
