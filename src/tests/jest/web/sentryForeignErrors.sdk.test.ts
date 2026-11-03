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

const eventWithFrames = (
    frames: { filename?: string; function?: string }[]
) => ({
    exception: {
        values: [
            {
                type: 'RangeError',
                value: 'Maximum call stack size exceeded',
                stacktrace: { frames },
            },
        ],
    },
});

const PICVIEWER =
    'chrome-extension://liilgpjgabokdklappibcjfablkpcekh/Picviewer%20CE+.user.js';

// Bugsink: пользовательский скрипт Picviewer CE+ в Edge 156 падал дважды за загрузку страницы
test.each([
    PICVIEWER,
    'moz-extension://0c3a8a2e-56a0-4c43-9a43-0b1e1b0a7c11/content.js',
    'safari-web-extension://8F1C2E61-6D7A-4C3B-9E0F-3B5A1D2C4E6F/script.js',
])('an error of an extension script %s is not reported', async (filename) => {
    const events = await sentEvents(() => {
        Sentry.captureEvent(
            eventWithFrames([
                { filename, function: 'init' },
                { filename, function: 'initLang' },
            ])
        );
    });

    expect(events).toEqual([]);
});

// расширение обернуло наш обработчик: ошибка возникла в нашем коде, её надо видеть
test('an error of our bundle called through an extension wrapper is still reported', async () => {
    const events = await sentEvents(() => {
        Sentry.captureEvent(
            eventWithFrames([
                { filename: PICVIEWER, function: 'checkFloatBar' },
                {
                    filename: 'https://labkeeper.io/assets/index-DYdH554R.js',
                    function: 'onPaste',
                },
            ])
        );
    });

    expect(events).toHaveLength(1);
});

// Bugsink: в Edge 155 расширение подменило Object.getOwnPropertyDescriptor и ушло в рекурсию
test('a stack without a single file of a page script is not reported', async () => {
    const events = await sentEvents(() => {
        Sentry.captureEvent(
            eventWithFrames([
                { function: 'Array.includes' },
                {
                    filename: '<anonymous>',
                    function:
                        'Object.getOwnPropertyDescriptor [as _getOwnPropertyDescriptor]',
                },
                {
                    filename: '<anonymous>',
                    function:
                        'Object.getOwnPropertyDescriptor [as _getOwnPropertyDescriptor]',
                },
            ])
        );
    });

    expect(events).toEqual([]);
});

// JSON.parse и другие встроенные функции тоже <anonymous>, но под ними наш код
test('an error thrown by a built-in called from our bundle is still reported', async () => {
    const events = await sentEvents(() => {
        Sentry.captureEvent(
            eventWithFrames([
                {
                    filename: 'https://labkeeper.io/assets/index-DYdH554R.js',
                    function: 'readProject',
                },
                { filename: '<anonymous>', function: 'JSON.parse' },
            ])
        );
    });

    expect(events).toHaveLength(1);
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
