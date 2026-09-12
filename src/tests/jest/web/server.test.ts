import axios from 'axios';
import * as Sentry from '@sentry/react';
import { Events } from '../../../model/service/ObserverService.ts';
import { WebRpi } from '../../../web/server';

const createRpi = () => {
    const observerService = {
        onEvent: jest.fn(),
        setUserState: jest.fn(),
    };
    return { rpi: new WebRpi(observerService), observerService };
};

jest.mock('../../../constants.ts', () => ({
    URLS: {
        renameFile: '/api/v2/public/project/{id}/file/rename',
        billingPricing: '/api/v4/public/billing/pricing',
        agentHistory: '/api/v4/public/project/{id}/history',
    },
}));

jest.mock('@sentry/react', () => ({
    captureException: jest.fn(),
    addBreadcrumb: jest.fn(),
}));

jest.mock('axios', () => ({
    __esModule: true,
    default: {
        post: jest.fn(),
        get: jest.fn(),
        delete: jest.fn(),
    },
}));

describe('WebRpi', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renameFileRequest passes old and new file names as-is', async () => {
        const postMock = axios.post as jest.Mock;
        postMock.mockResolvedValue({
            status: 200,
            data: {},
        });
        const { rpi } = createRpi();

        await rpi.renameFileRequest(
            'note.txt',
            'folder name/<>?.txt',
            'project-id'
        );

        expect(postMock).toHaveBeenCalledWith(
            expect.stringContaining('old=note.txt&new=folder name/<>?.txt')
        );
    });

    test('getBillingPricingRequest loads billing pricing', async () => {
        const getMock = axios.get as jest.Mock;
        const pricing = {
            servicePrices: {
                latexCompilationTokenCostPerSecond: 0,
                markdownCompilationTokenCostPerSecond: 0,
                gptTextPromptTokenCost: 1,
            },
            tokenPrices: [{ tokensToPurchase: 1, costRubles: 1 }],
            userRegularRefill: {
                refillTokensAmount: 1000,
                refillPeriodSeconds: 86400,
            },
            newUserInitialTokensCount: 1000,
        };
        getMock.mockResolvedValue({
            status: 200,
            data: pricing,
        });
        const { rpi, observerService } = createRpi();

        const result = await rpi.getBillingPricingRequest();

        expect(getMock).toHaveBeenCalledWith('/api/v4/public/billing/pricing');
        expect(result.body).toEqual(pricing);
        expect(result.isOk).toBe(true);
        expect(Sentry.captureException).not.toHaveBeenCalled();
        expect(observerService.onEvent).not.toHaveBeenCalled();
        expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
            expect.objectContaining({
                category: 'rpi',
                message: 'start getBillingPricingRequest',
            })
        );
        expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
            expect.objectContaining({
                category: 'rpi',
                message: 'getBillingPricingRequest 200',
                level: 'info',
            })
        );
    });

    test('does not report an expected error status to Sentry or Metrika', async () => {
        const getMock = axios.get as jest.Mock;
        getMock.mockRejectedValue({
            response: { status: 401, data: {} },
        });
        const { rpi, observerService } = createRpi();

        const result = await rpi.getAgentHistoryRequest('project-id');

        expect(result.code).toBe(401);
        expect(result.isUnauth).toBe(true);
        expect(Sentry.captureException).not.toHaveBeenCalled();
        expect(observerService.onEvent).not.toHaveBeenCalled();
    });

    test('reports an unexpected status to Sentry and Metrika and still returns the result', async () => {
        const getMock = axios.get as jest.Mock;
        getMock.mockRejectedValue({
            response: { status: 500, data: { message: 'boom' } },
        });
        const { rpi, observerService } = createRpi();

        const result = await rpi.getBillingPricingRequest();

        expect(result.code).toBe(500);
        expect(result.isOk).toBe(false);
        expect(result.body).toEqual({ message: 'boom' });
        expect(observerService.onEvent).toHaveBeenCalledWith(
            Events.EVENT_RPI_UNKNOWN
        );
        expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
            expect.objectContaining({
                category: 'rpi',
                message: 'getBillingPricingRequest 500',
                level: 'warning',
            })
        );
        expect(Sentry.captureException).toHaveBeenCalledTimes(1);
        const [error, context] = (Sentry.captureException as jest.Mock).mock
            .calls[0];
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe(
            'Unexpected RPI status 500 from getBillingPricingRequest'
        );
        expect(context.tags['rpi.method']).toBe('getBillingPricingRequest');
        expect(context.tags['rpi.status']).toBe('500');
        expect(context.extra.expectedCodes).toEqual([200]);
        expect(context.fingerprint).toEqual([
            'rpi-unexpected-status',
            'getBillingPricingRequest',
            '500',
        ]);
    });

    test('reports an unexpected success-path status to Sentry and Metrika', async () => {
        const getMock = axios.get as jest.Mock;
        getMock.mockResolvedValue({
            status: 201,
            data: {},
        });
        const { rpi, observerService } = createRpi();

        const result = await rpi.getBillingPricingRequest();

        expect(result.code).toBe(201);
        expect(result.isOk).toBe(true);
        expect(observerService.onEvent).toHaveBeenCalledWith(
            Events.EVENT_RPI_UNKNOWN
        );
        expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
            expect.objectContaining({
                category: 'rpi',
                message: 'getBillingPricingRequest 201',
                level: 'warning',
            })
        );
        expect(Sentry.captureException).toHaveBeenCalledTimes(1);
        expect(
            (Sentry.captureException as jest.Mock).mock.calls[0][0].message
        ).toBe('Unexpected RPI status 201 from getBillingPricingRequest');
    });

    test('does not report a network error without an HTTP status to Sentry or Metrika', async () => {
        const getMock = axios.get as jest.Mock;
        getMock.mockRejectedValue(new Error('Network Error'));
        const { rpi, observerService } = createRpi();

        const result = await rpi.getBillingPricingRequest();

        expect(result.code).toBe(500);
        expect(result.isOk).toBe(false);
        expect(Sentry.captureException).not.toHaveBeenCalled();
        expect(observerService.onEvent).not.toHaveBeenCalled();
        expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
            expect.objectContaining({
                category: 'rpi',
                message: 'getBillingPricingRequest network-error',
                level: 'warning',
            })
        );
    });

    test('getAgentHistoryRequest asks the history of the given project', async () => {
        const getMock = axios.get as jest.Mock;
        const history = [
            {
                id: 1,
                request: 'сделай таблицу',
                response: 'готово',
                createdAt: '2026-09-08T10:00:00Z',
            },
        ];
        getMock.mockResolvedValue({ status: 200, data: { history } });
        const { rpi } = createRpi();

        const result = await rpi.getAgentHistoryRequest('project-id');

        expect(getMock).toHaveBeenCalledWith(
            '/api/v4/public/project/project-id/history'
        );
        expect(result.body.history).toEqual(history);
        expect(result.isOk).toBe(true);
    });

    test('clearAgentHistoryRequest deletes the history of the given project', async () => {
        const deleteMock = axios.delete as jest.Mock;
        deleteMock.mockResolvedValue({ status: 200, data: {} });
        const { rpi } = createRpi();

        const result = await rpi.clearAgentHistoryRequest('project-id');

        expect(deleteMock).toHaveBeenCalledWith(
            '/api/v4/public/project/project-id/history'
        );
        expect(result.isOk).toBe(true);
    });
});
