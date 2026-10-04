import { fireEvent, render, screen } from '@testing-library/react';
import { Segments } from '../../../view/pages/project/editor/ide/segments';
import {
    MAX_SEGMENT_RECOVERIES,
    SEGMENT_FAILURE_WINDOW_MS,
} from '../../../view/pages/project/editor/ide/segments/segment-error-boundary';

// GH-134: прод упал с React #185 в layout-эффекте @uiw/react-codemirror,
// когда создавался редактор сегмента. Ошибку ловила граница роутера и
// закрывала проект. Редактор подменён: он падает так же, в layout-эффекте
// при создании, столько раз, сколько задано в mockFailures

const mockMounts: number[] = [];
const mockFailures = new Map<number, number>();
/** Сбои уже в рендере, до эффектов: так падает, например, сегмент без данных в сторе */
const mockRenderFailures = new Map<number, number>();
const mockState = {
    callback: { scrollEditorToBottom: false },
    ide: { activeSegmentIndex: -1 },
    persistence: { language: 'ru' },
    project: { currentProgram: { segments: [{}, {}] } },
};

jest.mock('../../../main.tsx', () => ({ controller: {} }));
jest.mock('react-redux', () => ({
    useDispatch: () => jest.fn(),
    // свежая ссылка, как у настоящего стора: reselect кэширует результат по ссылке на состояние
    useSelector: (selector: (state: unknown) => unknown) =>
        selector({ ...mockState }),
}));
jest.mock(
    '../../../view/pages/project/editor/ide/segments/latex-boundary-card',
    () => ({
        LatexHeaderBoundaryCard: () => null,
        LatexFooterBoundaryCard: () => null,
    })
);
jest.mock(
    '../../../view/pages/project/editor/ide/segments/segment-divider',
    () => ({
        SegmentDivider: () => null,
    })
);
// снятие выделения по клику тянет за собой CodeMirror, а здесь клики не нужны
jest.mock(
    '../../../view/pages/project/editor/ide/segments/ideSegmentDeactivate',
    () => ({
        deactivateIdeSegment: jest.fn(),
        getIdeSegmentIndexFromTarget: jest.fn(),
        isClickOutsideAllIdeSegments: jest.fn(),
    })
);
jest.mock('../../../view/pages/project/editor/ide/segments/segment', () => {
    const { createElement, useLayoutEffect } =
        jest.requireActual<typeof import('react')>('react');
    return {
        SegmentEditor: ({
            index,
            isLast,
        }: {
            index: number;
            isLast: boolean;
        }) => {
            const renderLeft = mockRenderFailures.get(index) ?? 0;
            if (renderLeft > 0) {
                mockRenderFailures.set(index, renderLeft - 1);
                throw new TypeError(
                    "Cannot read properties of undefined (reading 'parameters')"
                );
            }
            useLayoutEffect(() => {
                mockMounts.push(index);
                const left = mockFailures.get(index) ?? 0;
                if (left > 0) {
                    mockFailures.set(index, left - 1);
                    throw new Error('Minified React error #185');
                }
            }, [index, isLast]);
            return createElement(
                'div',
                { 'data-testid': `segment-${index}` },
                `сегмент ${index}`
            );
        },
    };
});

const mountsOf = (index: number) =>
    mockMounts.filter((i) => i === index).length;

beforeEach(() => {
    mockMounts.length = 0;
    mockFailures.clear();
    mockRenderFailures.clear();
    mockState.project = { currentProgram: { segments: [{}, {}] } };
});

afterEach(() => {
    jest.restoreAllMocks();
});

test('сбой при создании редактора пересоздаёт только этот сегмент', () => {
    mockFailures.set(1, 1);
    const onCaughtError = jest.fn();

    render(<Segments />, { onCaughtError });

    expect(screen.getByTestId('segment-0').textContent).toBe('сегмент 0');
    expect(screen.getByTestId('segment-1').textContent).toBe('сегмент 1');
    // соседа не трогали, упавший создан заново
    expect(mountsOf(0)).toBe(1);
    expect(mountsOf(1)).toBe(2);
    // ошибка поймана, а не потеряна: в проде onCaughtError отдаёт её в Bugsink
    expect(onCaughtError).toHaveBeenCalledTimes(1);
    expect(onCaughtError.mock.calls[0][0].message).toContain('#185');
    expect(screen.queryByRole('alert')).toBeNull();
});

test('сбой в первом же рендере сегмента тоже лечится пересозданием', () => {
    // первую ошибку React лечит сам, повторив рендер синхронно; до границы доходит вторая
    mockRenderFailures.set(1, 2);
    const onCaughtError = jest.fn();

    render(<Segments />, { onCaughtError, onRecoverableError: jest.fn() });

    expect(screen.getByTestId('segment-1').textContent).toBe('сегмент 1');
    expect(onCaughtError).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
});

test('сегмент, который падает раз за разом, показывает заглушку с повтором', () => {
    mockFailures.set(1, Infinity);

    render(<Segments />, { onCaughtError: jest.fn() });

    // первая попытка и все пересоздания упали, дальше граница не крутит
    expect(mountsOf(1)).toBe(MAX_SEGMENT_RECOVERIES + 1);
    expect(screen.getByRole('alert').textContent).toContain(
        'Сегмент не удалось показать'
    );
    expect(screen.queryByTestId('segment-1')).toBeNull();
    // остальная страница на месте
    expect(screen.getByTestId('segment-0').textContent).toBe('сегмент 0');

    // повтор начинает счёт заново: один сбой после него лечится, а не возвращает заглушку
    mockFailures.set(1, 1);
    fireEvent.click(screen.getByRole('button', { name: 'Показать снова' }));

    expect(screen.getByTestId('segment-1').textContent).toBe('сегмент 1');
    expect(screen.queryByRole('alert')).toBeNull();
});

test('редкие сбои за долгую сессию лечатся каждый раз', () => {
    let now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    const onCaughtError = jest.fn();
    const { rerender } = render(<Segments />, { onCaughtError });

    // сбоев больше лимита, но каждый приходит после окна: заглушки быть не должно
    for (let round = 0; round <= MAX_SEGMENT_RECOVERIES; round++) {
        now += SEGMENT_FAILURE_WINDOW_MS + 1;
        mockFailures.set(1, 1);
        // третий сегмент снимает с первого isLast, и его эффект запускается снова
        mockState.project = {
            currentProgram: {
                segments: round % 2 === 0 ? [{}, {}, {}] : [{}, {}],
            },
        };
        rerender(<Segments />);
    }

    expect(onCaughtError).toHaveBeenCalledTimes(MAX_SEGMENT_RECOVERIES + 1);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByTestId('segment-1').textContent).toBe('сегмент 1');
});
