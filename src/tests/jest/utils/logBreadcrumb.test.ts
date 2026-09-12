import * as Sentry from '@sentry/react';
import { logBreadcrumb } from '../../../viewModel/utils/logBreadcrumb.ts';

jest.mock('@sentry/react', () => ({
    addBreadcrumb: jest.fn(),
}));

test('logBreadcrumb writes a Sentry breadcrumb and a console line', () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});

    logBreadcrumb('rpi', 'start getUserInfoRequest', {
        method: 'getUserInfoRequest',
    });

    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'rpi',
        message: 'start getUserInfoRequest',
        data: { method: 'getUserInfoRequest' },
        level: 'info',
    });
    expect(info).toHaveBeenCalledWith('[rpi] start getUserInfoRequest', {
        method: 'getUserInfoRequest',
    });

    info.mockRestore();
});
