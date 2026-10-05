import '../polyfills/textEncoder.ts';
import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import {
    MemoryRouter,
    Outlet,
    Route,
    Routes,
    useNavigate,
    type NavigateFunction,
} from 'react-router-dom';
import {
    useAgentModeNavigation,
    useAgentModeTracking,
} from '../../../view/hooks/useAgentMode.ts';

// Заказчик попросил видеть вход в агентский режим в OpenPanel. Кнопки раньше
// слали событие сами, а вход ссылкой, перезагрузкой и кнопками браузера
// проходил мимо аналитики

const mockTrackUiEvent = jest.fn();
jest.mock('../../../main.tsx', () => ({
    controller: {
        trackUiEvent: (...args: unknown[]) => mockTrackUiEvent(...args),
    },
}));

type Actions = ReturnType<typeof useAgentModeNavigation> & {
    navigate: NavigateFunction;
};
const actions: { current: Actions | null } = { current: null };

/** Страница проекта в миниатюре: учёт переходов и кнопки режима */
const ProjectProbe = () => {
    useAgentModeTracking();
    const navigation = useAgentModeNavigation();
    const navigate = useNavigate();
    useEffect(() => {
        actions.current = { ...navigation, navigate };
    });
    return null;
};

// как в приложении: обе страницы под общим маршрутом, и при смене режима
// страница проекта не пересоздаётся
const renderAt = (initial: string) =>
    render(
        <MemoryRouter initialEntries={[initial]}>
            <Routes>
                <Route path="/" element={<Outlet />}>
                    <Route path="project/:id" element={<ProjectProbe />} />
                    <Route
                        path="project/:id/agent"
                        element={<ProjectProbe />}
                    />
                </Route>
            </Routes>
        </MemoryRouter>
    );

const events = () =>
    mockTrackUiEvent.mock.calls.map(([event, properties]) => [
        event,
        (properties as { source: string }).source,
    ]);

beforeEach(() => {
    mockTrackUiEvent.mockClear();
    actions.current = null;
});

test('вход и выход кнопками уходят со своим источником', async () => {
    renderAt('/project/p1');
    // обычный режим при открытии страницы переходом не считается
    expect(events()).toEqual([]);

    await act(async () => actions.current!.enterAgentMode('viewer_tab'));
    await act(async () => actions.current!.leaveAgentMode('button'));
    await act(async () => actions.current!.enterAgentMode('project_settings'));

    expect(events()).toEqual([
        ['agent_mode_entered', 'viewer_tab'],
        ['agent_mode_left', 'button'],
        ['agent_mode_entered', 'project_settings'],
    ]);
    expect(mockTrackUiEvent.mock.calls[0][1]).toMatchObject({
        project_id: 'p1',
    });
});

test('открытие режима ссылкой или перезагрузкой тоже уходит в аналитику', async () => {
    renderAt('/project/p1/agent');

    expect(events()).toEqual([['agent_mode_entered', 'page_load']]);

    // приложение после загрузки проекта переписывает адрес на месте: это не переход
    await act(async () =>
        actions.current!.navigate('/project/p1/agent', { replace: true })
    );
    expect(events()).toEqual([['agent_mode_entered', 'page_load']]);
});

test('кнопки браузера «назад» и «вперёд» уходят как переход по истории', async () => {
    renderAt('/project/p1');
    await act(async () => actions.current!.enterAgentMode('viewer_tab'));

    await act(async () => actions.current!.navigate(-1));
    await act(async () => actions.current!.navigate(1));

    // «вперёд» возвращает запись с источником кнопки, но переход сделал браузер
    expect(events()).toEqual([
        ['agent_mode_entered', 'viewer_tab'],
        ['agent_mode_left', 'history'],
        ['agent_mode_entered', 'history'],
    ]);
});

test('ссылка внутри приложения без источника уходит как link', async () => {
    renderAt('/project/p1');

    await act(async () => actions.current!.navigate('/project/p1/agent'));

    expect(events()).toEqual([['agent_mode_entered', 'link']]);
});
