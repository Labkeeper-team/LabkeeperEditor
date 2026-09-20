import { OpenPanel } from '@openpanel/web';
import {
    ANALYTICS_DISABLED_STORAGE_KEY,
    OpenPanelService,
} from '../../../web/openpanel';
import { getSessionId } from '../../../web/session.ts';

const track = jest.fn().mockResolvedValue(undefined);

jest.mock('@openpanel/web', () => ({
    OpenPanel: jest.fn(() => ({
        track,
        identify: jest.fn(),
    })),
}));

jest.mock('../../../constants.ts', () => ({
    Secrets: {
        openpanelClientId: 'IO_LABKEEPER_FRONTEND_OPENPANEL_CLIENT_ID',
        openpanelApiUrl: '',
        sentryDsn: '',
    },
}));

jest.mock('../../../viewModel/utils/logBreadcrumb.ts', () => ({
    logBreadcrumb: jest.fn(),
}));

describe('OpenPanelService without credentials', () => {
    beforeEach(() => {
        window.localStorage.removeItem(ANALYTICS_DISABLED_STORAGE_KEY);
    });

    test('onEvent is a no-op when the client is not configured', () => {
        const service = new OpenPanelService();

        service.onEvent('start_run', { trigger: 'button' });

        expect(OpenPanel).not.toHaveBeenCalled();
        expect(track).not.toHaveBeenCalled();
    });

    // на стенде без ключей заголовка сессии нет и у гостя: init выходит до выдачи id
    test('a guest gets no session id when the keys are missing', async () => {
        const service = new OpenPanelService();

        await service.init();

        expect(getSessionId()).toBeUndefined();
    });
});
