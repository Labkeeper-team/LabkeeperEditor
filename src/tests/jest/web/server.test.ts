import axios from 'axios';

jest.mock('../../../constants.ts', () => ({
    URLS: {
        renameFile: '/api/v2/public/project/{id}/file/rename',
        billingPricing: '/api/v4/public/billing/pricing',
        agentHistory: '/api/v4/public/project/{id}/history',
    },
}));

import { WebRpi } from '../../../web/server';

jest.mock('axios', () => ({
    __esModule: true,
    default: {
        post: jest.fn(),
        get: jest.fn(),
        delete: jest.fn(),
    },
}));

describe('WebRpi', () => {
    test('renameFileRequest passes old and new file names as-is', async () => {
        const postMock = axios.post as jest.Mock;
        postMock.mockResolvedValue({
            status: 200,
            data: {},
        });
        const rpi = new WebRpi();

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
        const rpi = new WebRpi();

        const result = await rpi.getBillingPricingRequest();

        expect(getMock).toHaveBeenCalledWith('/api/v4/public/billing/pricing');
        expect(result.body).toEqual(pricing);
        expect(result.isOk).toBe(true);
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
        const rpi = new WebRpi();

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
        const rpi = new WebRpi();

        const result = await rpi.clearAgentHistoryRequest('project-id');

        expect(deleteMock).toHaveBeenCalledWith(
            '/api/v4/public/project/project-id/history'
        );
        expect(result.isOk).toBe(true);
    });
});
