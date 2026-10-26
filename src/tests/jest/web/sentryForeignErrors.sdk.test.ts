/**
 * @jest-environment-options {"url": "https://labkeeper.io/project/default"}
 */
// настоящий SDK с опциями из main.tsx: чужие ошибки до сети не доходят, свои доходят
import * as Sentry from '@sentry/react';
import type { ErrorEvent } from '@sentry/react';
import { sentryOptions } from '../../../web/sentry/hooks.ts';

const eventWithTopFrame = (message: string, filename: string) => ({
    exception: {
        values: [
            {
                type: 'Error',
                value: message,
                stacktrace: {
                    frames: [{ filename, lineno: 233, colno: 11 }],
                },
            },
        ],
    },
});

const sentEvents = async (send: () => void): Promise<ErrorEvent[]> => {
    const bodies: string[] = [];
    Sentry.init({
        ...sentryOptions(() => {}),
        dsn: 'https://key@sentry.test/1',
        transport: (options) =>
            Sentry.createTransport(options, async (request) => {
                bodies.push(String(request.body));
                return { statusCode: 200 };
            }),
    });
    send();
    // close отправляет очередь и снимает клиента, следующий опыт заводит свой
    await Sentry.close(2000);
    return bodies
        .filter((body) => body.includes('"type":"event"'))
        .map((body) => JSON.parse(body.split('\n')[2]) as ErrorEvent);
};

// Bugsink: Brave на iOS вставляет скрипт режима чтения, он падает на window.__firefox__
test('the reader script of Brave on iOS is not reported', async () => {
    const events = await sentEvents(() => {
        Sentry.captureException(
            new ReferenceError("Can't find variable: __firefox__")
        );
        Sentry.captureException(
            new TypeError(
                "undefined is not an object (evaluating 'window.__firefox__.reader')"
            )
        );
    });

    expect(events).toEqual([]);
});

// Bugsink: расширение Edge обернуло воркер в blob: и уронило его на fetch
test('an error from a blob: script of an extension is not reported', async () => {
    const events = await sentEvents(() => {
        Sentry.captureEvent(
            eventWithTopFrame(
                'Uncaught ReferenceError: fetch is not defined',
                'blob:https://labkeeper.io/f84ff671-bdf6-458a-be78-081a7b36e83b'
            )
        );
    });

    expect(events).toEqual([]);
});

test('an error of our own bundle is still reported', async () => {
    const events = await sentEvents(() => {
        Sentry.captureEvent(
            eventWithTopFrame(
                'Uncaught ReferenceError: fetch is not defined',
                'https://labkeeper.io/assets/index-DYdH554R.js'
            )
        );
    });

    expect(events).toHaveLength(1);
});
