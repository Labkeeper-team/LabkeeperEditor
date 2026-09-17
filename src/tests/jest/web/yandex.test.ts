import { MetrikaService } from '../../../web/yandex';
import { Events } from '../../../model/service/ObserverService.ts';

const METRIKA_KEY = '12345678';

jest.mock('../../../constants.ts', () => ({
    Secrets: {
        yandexMetrikaKey: '12345678',
    },
}));

jest.mock('../../../viewModel/utils/logBreadcrumb.ts', () => ({
    logBreadcrumb: jest.fn(),
}));

describe('MetrikaService whitelist', () => {
    const ym = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.setItem('labkeeper_cookie_consent', 'accepted');
        Object.defineProperty(window, 'ym', {
            configurable: true,
            writable: true,
            value: ym,
        });
    });

    afterEach(() => {
        localStorage.removeItem('labkeeper_cookie_consent');
        delete (window as { ym?: unknown }).ym;
    });

    test('reachGoal is sent only for current Metrika events', () => {
        const service = new MetrikaService();

        service.onEvent(Events.EVENT_RUN);
        service.onEvent(Events.EVENT_CREATE_PROJECT);
        service.onEvent(Events.EVENT_AGENT_STARTED);

        expect(ym).toHaveBeenCalledTimes(3);
        expect(ym).toHaveBeenCalledWith(METRIKA_KEY, 'reachGoal', 'start_run');
        expect(ym).toHaveBeenCalledWith(
            METRIKA_KEY,
            'reachGoal',
            'create_project'
        );
        expect(ym).toHaveBeenCalledWith(
            METRIKA_KEY,
            'reachGoal',
            'agent_started'
        );
    });

    test('new OpenPanel-only keys do not go to ym', () => {
        const service = new MetrikaService();

        service.onEvent(Events.EVENT_COMPILE_SUCCEEDED);
        service.onEvent(Events.EVENT_LOGIN_SUCCEEDED);
        service.onEvent(Events.EVENT_PAGE_VIEWED);
        service.onEvent(Events.EVENT_AGENT_FAILED);

        expect(ym).not.toHaveBeenCalled();
    });
});
