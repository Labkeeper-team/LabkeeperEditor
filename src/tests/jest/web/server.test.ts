import axios from 'axios';

jest.mock('../../../constants.ts', () => ({
    URLS: {
        renameFile: '/api/v2/public/project/{id}/file/rename',
        billingPricing: '/api/v4/public/billing/pricing',
    },
}));

import { WebRpi } from '../../../web/server';

jest.mock('axios', () => ({
    __esModule: true,
    default: {
        post: jest.fn(),
        get: jest.fn(),
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
                gptImagePromptTokenCost: 2,
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
});
