import { expect, test, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';
import { Program, Segment } from '../../model/domain.ts';

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';
const SEGMENT_COUNT = 20;
const TYPED_SEGMENT = 5;

declare global {
    interface Window {
        __renderedSegmentEditors: number[];
    }
}

function programOf(segments: Segment[]): Program {
    return { segments, parameters: { roundStrategy: 'noRound' } };
}

// лишний рендер в DOM не виден, поэтому смотрим хук React DevTools: при рендере React собирает список хуков заново, без рендера переносит прежний
async function recordSegmentEditorRenders(page: Page) {
    await page.addInitScript(() => {
        type Fiber = {
            child: Fiber | null;
            sibling: Fiber | null;
            memoizedProps: { index?: number; className?: unknown } | null;
            memoizedState: unknown;
        };
        const lastHooks = new Map<number, unknown>();
        window.__renderedSegmentEditors = [];

        const isSegmentEditor = (fiber: Fiber) => {
            const root = fiber.child?.memoizedProps?.className;
            return (
                typeof fiber.memoizedProps?.index === 'number' &&
                typeof root === 'string' &&
                root.startsWith('segment-hunk-block')
            );
        };

        (
            window as unknown as { __REACT_DEVTOOLS_GLOBAL_HOOK__: object }
        ).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
            supportsFiber: true,
            renderers: new Map(),
            inject: () => 1,
            checkDCE: () => {},
            onScheduleFiberRoot: () => {},
            onCommitFiberUnmount: () => {},
            onPostCommitFiberRoot: () => {},
            onCommitFiberRoot: (_id: number, root: { current: Fiber }) => {
                const stack: Fiber[] = [root.current];
                while (stack.length) {
                    const fiber = stack.pop() as Fiber;
                    if (isSegmentEditor(fiber)) {
                        const index = fiber.memoizedProps?.index as number;
                        const previous = lastHooks.get(index);
                        if (
                            previous !== undefined &&
                            previous !== fiber.memoizedState
                        ) {
                            window.__renderedSegmentEditors.push(index);
                        }
                        lastHooks.set(index, fiber.memoizedState);
                    }
                    if (fiber.sibling) {
                        stack.push(fiber.sibling);
                    }
                    if (fiber.child) {
                        stack.push(fiber.child);
                    }
                }
            },
        };
    });
}

test('typing-in-a-segment-rerenders-only-that-segment', async ({ page }) => {
    // первое открытие ждёт до 30 с, и тесту нужен запас сверх этого
    test.setTimeout(60_000);
    const segments = Array.from(
        { length: SEGMENT_COUNT },
        (_, index): Segment => ({
            id: index + 1,
            type: 'md',
            text: `segment ${index + 1}`,
            parameters: { visible: true },
        })
    );
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest();
    await routeSetup.setupGetProjectRequest(
        200,
        'default',
        programOf(segments)
    );
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    await routeSetup.setupAgentHistoryRequest([]);
    await routeSetup.setupAgentSocket([]);
    await recordSegmentEditorRenders(page);

    // после открытия проект ещё дочитывает файлы и hunks, и ввод до их ответа может потеряться
    const startupFinished = Promise.all([
        page.waitForResponse((response) =>
            response.url().includes('/file/list')
        ),
        page.waitForResponse((response) => /\/hunk$/.test(response.url())),
    ]);
    await page.goto(`/project/${uuid}`);
    const editors = page.locator('.segment-editor-container .cm-content');
    // первое открытие на холодном dev-сервере под нагрузкой бывает дольше пяти секунд
    await expect(editors).toHaveCount(SEGMENT_COUNT, { timeout: 30_000 });

    await startupFinished;

    const typed = editors.nth(TYPED_SEGMENT);
    await typed.click();
    await typed.press('End');
    await expect(
        page.locator('.segment-editor-container.is-active')
    ).toHaveCount(1);
    // активный сегмент подсвечивается с задержкой, её рендеры в замер не берём
    await page.waitForTimeout(500);
    await page.evaluate(() => {
        window.__renderedSegmentEditors = [];
    });

    await typed.pressSequentially('x');
    await expect(typed).toContainText(`segment ${TYPED_SEGMENT + 1}x`);
    await page.waitForTimeout(300);

    // с сотней сегментов каждое лишнее обновление стоило около миллисекунды на нажатие
    const rendered = await page.evaluate(() => [
        ...new Set(window.__renderedSegmentEditors),
    ]);
    expect(rendered).toEqual([TYPED_SEGMENT]);
});
