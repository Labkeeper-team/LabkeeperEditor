import { OpenPanel } from '@openpanel/web';
import {
    ANALYTICS_DISABLED_STORAGE_KEY,
    OpenPanelService,
} from '../../../web/openpanel';

const track = jest.fn().mockResolvedValue(undefined);

jest.mock('@openpanel/web', () => ({
    OpenPanel: jest.fn(() => ({
        track,
        identify: jest.fn(),
    })),
}));

jest.mock('../../../constants.ts', () => ({
    Secrets: {
        openpanelClientId: 'client-1',
        openpanelApiUrl: 'http://localhost:4401',
        sentryDsn: 'https://key@o1.ingest.sentry.io/99',
    },
}));

jest.mock('../../../viewModel/utils/logBreadcrumb.ts', () => ({
    logBreadcrumb: jest.fn(),
}));

describe('OpenPanelService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        track.mockResolvedValue(undefined);
        window.localStorage.removeItem(ANALYTICS_DISABLED_STORAGE_KEY);
    });

    afterEach(() => {
        window.localStorage.removeItem(ANALYTICS_DISABLED_STORAGE_KEY);
    });

    test('trackSentryEvent sends event id and sentry url', () => {
        const service = new OpenPanelService();

        service.trackSentryEvent({
            event_id: 'abc123',
            level: 'error',
            message: 'boom',
        });

        expect(OpenPanel).toHaveBeenCalled();
        expect(track).toHaveBeenCalledWith('[E] Error reported to sentry', {
            event_id: 'abc123',
            sentry_url: 'https://sentry.io/issues/?project=99&query=abc123',
            level: 'error',
            message: 'boom',
        });
    });

    test('trackSentryEvent uses exception value when message is empty', () => {
        const service = new OpenPanelService();

        service.trackSentryEvent({
            event_id: 'abc123',
            exception: { values: [{ value: 'TypeError: x' }] },
        });

        expect(track).toHaveBeenCalledWith(
            '[E] Error reported to sentry',
            expect.objectContaining({
                message: 'TypeError: x',
            })
        );
    });

    test('trackSentryEvent skips events without id', () => {
        const service = new OpenPanelService();

        service.trackSentryEvent({ message: 'boom' });

        expect(track).not.toHaveBeenCalled();
    });

    test('onEvent maps the catalog key to an [E] name and forwards properties', () => {
        const service = new OpenPanelService();

        service.onEvent('start_run', { trigger: 'hotkey', segment_count: 3 });

        expect(OpenPanel).toHaveBeenCalled();
        expect(track).toHaveBeenCalledWith('[E] Run clicked', {
            trigger: 'hotkey',
            segment_count: 3,
        });
    });

    test('onEvent keeps an unknown key as-is under the [E] prefix', () => {
        const service = new OpenPanelService();

        service.onEvent('custom_key', { ok: true });

        expect(track).toHaveBeenCalledWith('[E] custom_key', { ok: true });
    });

    test('a remembered flag does not create a client or send events', async () => {
        window.localStorage.setItem(ANALYTICS_DISABLED_STORAGE_KEY, '1');
        const service = new OpenPanelService();

        await service.init('user-1');
        service.onEvent('start_run');

        expect(OpenPanel).not.toHaveBeenCalled();
        expect(track).not.toHaveBeenCalled();
    });
});
