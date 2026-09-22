/**
 * @jest-environment-options {"url": "http://localhost:3000/project/default"}
 */
import type { ErrorEvent } from '@sentry/react';
import { createBeforeSend } from '../../../web/sentry/hooks.ts';

test('drops events on the dev host and keeps them away from openpanel', () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const onEvent = jest.fn();
    const event: ErrorEvent = { type: undefined, message: 'boom' };

    expect(createBeforeSend(onEvent)(event)).toBeNull();
    expect(onEvent).not.toHaveBeenCalled();
});
