/**
 * @jest-environment-options {"url": "https://labkeeper.io/project/default"}
 */
// Настоящие React и Sentry: опыт читает конверт события перед отправкой в сеть
import * as Sentry from '@sentry/react';
import type { ErrorEvent } from '@sentry/react';
import {
    Component,
    act,
    useEffect,
    useLayoutEffect,
    useState,
    type ReactNode,
} from 'react';
import { createRoot } from 'react-dom/client';
import { reactRootErrorOptions } from '../../../web/sentry/hooks.ts';

(
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// Так ведёт себя компонент из GH-134: обновление состояния на каждом рендере
function LoopingPromptPanel() {
    const [renders, setRenders] = useState(0);
    // цикл обновлений нарочный: опыт проверяет, что его видно в событии
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useLayoutEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRenders(renders + 1);
    });
    return <div>{renders}</div>;
}

// Как RouterErrorBoundary: страница ошибки сама отправляет её из useEffect
function ErrorPage({ error }: { error: unknown }) {
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);
    return <p>error page</p>;
}

// Как граница роутера с errorElement: ловит ошибку и показывает страницу ошибки
class RouteBoundary extends Component<
    { children: ReactNode },
    { error: unknown }
> {
    state = { error: null as unknown };

    static getDerivedStateFromError(error: unknown) {
        return { error };
    }

    render() {
        return this.state.error ? (
            <ErrorPage error={this.state.error} />
        ) : (
            this.props.children
        );
    }
}

test('пойманная ошибка уходит в Sentry со стеком компонентов и один раз', async () => {
    const bodies: string[] = [];
    jest.spyOn(console, 'error').mockImplementation(() => {});
    Sentry.init({
        dsn: 'https://key@sentry.test/1',
        transport: (options) =>
            Sentry.createTransport(options, async (request) => {
                bodies.push(String(request.body));
                return { statusCode: 200 };
            }),
    });

    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host, reactRootErrorOptions());
    await act(async () => {
        root.render(
            <RouteBoundary>
                <LoopingPromptPanel />
            </RouteBoundary>
        );
    });
    await Sentry.flush(2000);

    expect(host.textContent).toBe('error page');
    const events = bodies
        .filter((body) => body.includes('"type":"event"'))
        .map((body) => JSON.parse(body.split('\n')[2]) as ErrorEvent);
    // граница отправила ту же ошибку второй раз, но событие одно
    expect(events).toHaveLength(1);
    // стек компонентов Sentry кладёт связанной ошибкой, её кадры это компоненты
    const reactStack = events[0].exception?.values?.find(
        (value) => value.type === 'React ErrorBoundary Error'
    );
    const components = (reactStack?.stacktrace?.frames ?? []).map(
        (frame) => frame.function
    );
    // по стеку видно, какой компонент зациклился
    expect(components).toContain('LoopingPromptPanel');
    expect(JSON.stringify(events[0].exception)).toContain(
        'Maximum update depth exceeded'
    );

    root.unmount();
});
