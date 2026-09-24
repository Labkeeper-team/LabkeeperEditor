import { OpenPanel } from '@openpanel/web';
import { Events } from '../../../model/service/ObserverService.ts';
import {
    ANALYTICS_DISABLED_STORAGE_KEY,
    OpenPanelService,
} from '../../../web/openpanel';

const track = jest.fn().mockResolvedValue(undefined);
const setGlobalProperties = jest.fn();

jest.mock('@openpanel/web', () => ({
    OpenPanel: jest.fn(() => ({
        track,
        identify: jest.fn(),
        setGlobalProperties,
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

    test('a locked project goes under its own [E] name with its properties', () => {
        const service = new OpenPanelService();
        const properties = {
            source: 'program',
            operation: 'saveProgramRequest',
            expected: true,
            project_id: 'project-1',
        };

        service.onEvent(Events.EVENT_PROJECT_LOCKED, properties);

        expect(track).toHaveBeenCalledWith('[E] Project locked', properties);
    });

    test('onEvent keeps an unknown key as-is under the [E] prefix', () => {
        const service = new OpenPanelService();

        service.onEvent('custom_key', { ok: true });

        expect(track).toHaveBeenCalledWith('[E] custom_key', { ok: true });
    });

    test('client gets the referrer without the captcha token', () => {
        const referrer = jest
            .spyOn(document, 'referrer', 'get')
            .mockReturnValue(
                'https://labkeeper.io/project/default?captcha=e2e-token&type=latex'
            );

        new OpenPanelService().onEvent('start_run');
        referrer.mockRestore();

        expect(setGlobalProperties).toHaveBeenCalledWith({
            __referrer:
                'https://labkeeper.io/project/default?captcha=[Filtered]&type=latex',
        });
        expect(setGlobalProperties.mock.invocationCallOrder[0]).toBeLessThan(
            track.mock.invocationCallOrder[0]
        );
    });

    test('a remembered flag does not create a client or send events', async () => {
        window.localStorage.setItem(ANALYTICS_DISABLED_STORAGE_KEY, '1');
        const service = new OpenPanelService();

        await service.init('user-1');
        service.onEvent('start_run');

        expect(OpenPanel).not.toHaveBeenCalled();
        expect(track).not.toHaveBeenCalled();
    });

    // e2e ставит флаг, а 423 ловит любой запрос: без этого прогоны e2e попали бы в отчёт о замках
    test('a locked event under the analytics flag is not sent', () => {
        window.localStorage.setItem(ANALYTICS_DISABLED_STORAGE_KEY, '1');
        const service = new OpenPanelService();

        service.onEvent(Events.EVENT_PROJECT_LOCKED, {
            operation: 'saveProgramRequest',
        });

        expect(OpenPanel).not.toHaveBeenCalled();
        expect(track).not.toHaveBeenCalled();
    });
});
