/**
 * @jest-environment-options {"url": "https://labkeeper.io/project/1"}
 */
jest.mock('../../../constants.ts', () => {
    (globalThis as unknown as { __BUILD_INFO__: unknown }).__BUILD_INFO__ = {
        major: '4',
        minor: '0',
    };
    return jest.requireActual('../../../constants.ts');
});

import { WS_URLS, wsUrl } from '../../../constants.ts';

test('secure-page-gets-a-secure-socket-scheme', () => {
    // страница по https не имеет права открывать ws:, браузер такое соединение рвёт
    expect(wsUrl(WS_URLS.unauthorizedAgent)).toBe(
        'wss://labkeeper.io/api/v4/ws/prompt'
    );
});
