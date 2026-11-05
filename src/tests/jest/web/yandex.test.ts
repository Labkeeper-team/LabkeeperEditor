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

    test('only the business goals go to Metrika', () => {
        const service = new MetrikaService();

        service.onEvent(Events.EVENT_RUN);
        service.onEvent(Events.EVENT_AGENT_STARTED);
        service.onEvent(Events.EVENT_PAYMENT_SUCCESS);

        expect(ym.mock.calls).toEqual([
            [METRIKA_KEY, 'reachGoal', 'start_run'],
            [METRIKA_KEY, 'reachGoal', 'agent_started'],
            [METRIKA_KEY, 'reachGoal', 'payment_success'],
        ]);
    });

    test('other events do not go to Metrika', () => {
        const service = new MetrikaService();

        service.onEvent(Events.EVENT_CREATE_PROJECT);
        service.onEvent(Events.EVENT_PAYMENT_REQUIRED);
        service.onEvent(Events.EVENT_PAYMENT_STARTED);
        service.onEvent(Events.EVENT_AGENT_FINISHED);
        service.onEvent(Events.EVENT_ERROR);
        service.onEvent(Events.FRONTEND_ERROR);
        service.onEvent(Events.EVENT_COMPILE_SUCCEEDED);
        service.onEvent(Events.EVENT_PAGE_VIEWED);

        expect(ym).not.toHaveBeenCalled();
    });
});
