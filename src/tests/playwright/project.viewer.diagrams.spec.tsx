import { expect, test, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';
import { Program, Segment, SegmentType } from '../../model/domain.ts';

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

function segment(id: number, type: SegmentType, text: string): Segment {
    return { id, type, text, parameters: { visible: true } };
}

function programOf(segments: Segment[]): Program {
    return { segments, parameters: { roundStrategy: 'noRound' } };
}

async function openProject(page: Page, segments: Segment[]) {
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
    await page.goto(`/project/${uuid}`);
    const editors = page.locator('.segment-editor-container .cm-content');
    // первое открытие на холодном dev-сервере под нагрузкой бывает дольше пяти секунд
    await expect(editors).toHaveCount(segments.length, { timeout: 30_000 });
}

// В markdown-проекте схему рисует браузер: движки грузятся на странице, сервер не нужен
test('mermaid-and-plantuml-are-drawn-in-the-browser', async ({ page }) => {
    await openProject(page, [
        segment(1, 'mermaid', 'flowchart LR\n    A[Измерение] --> B[Отчёт]'),
        segment(
            2,
            'plantuml',
            '@startuml\nСтудент -> Преподаватель : Отчёт\n@enduml'
        ),
    ]);

    const images = page.locator('img.diagram-segment-image');
    await expect(images).toHaveCount(2, { timeout: 30_000 });
    for (const image of await images.all()) {
        await expect
            .poll(() =>
                image.evaluate((img: HTMLImageElement) => img.naturalWidth)
            )
            .toBeGreaterThan(0);
    }
    await expect(page.locator('.diagram-segment-error')).toHaveCount(0);
});

test('broken-diagram-shows-the-parser-error', async ({ page }) => {
    await openProject(page, [segment(1, 'mermaid', 'flowchart LR\n    A -->')]);

    await expect(page.locator('.diagram-segment-error')).toContainText(
        'Parse error',
        { timeout: 30_000 }
    );
});
