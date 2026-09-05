import { expect, test, type Page } from '@playwright/test';
import { Hunk, Program, Segment } from '../../model/domain.ts';
import { RouteSetup } from './mock.routeSetUp.tsx';

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

const LINE_COUNT = 17;

test.use({
    viewport: { width: 1280, height: 900 },
});

function mdSegment(id: number, text: string): Segment {
    return {
        id,
        type: 'md',
        text,
        parameters: { visible: true },
    };
}

function programOf(...segments: Segment[]): Program {
    return {
        segments,
        parameters: { roundStrategy: 'noRound' },
    };
}

function numberedLines(count: number): string {
    return Array.from({ length: count }, (_, index) => String(index + 1)).join(
        '\n'
    );
}

const LONG_LINE =
    'A very long added line that should wrap across the editor width ' +
    'word '.repeat(24).trim();

const MULTILINE_TEXT = [LONG_LINE, LONG_LINE, LONG_LINE].join('\n');

async function openProjectWithHunks(
    page: Page,
    options: {
        program: Program;
        hunks: Hunk[];
        files?: { fileName: string; url: string }[];
        fileContents?: { urlPath: string; content: string }[];
    }
) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest();
    await routeSetup.setupGetProjectRequest(200, 'default', options.program);
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    if (options.files) {
        await routeSetup.setupListFilesCustom(options.files);
    } else {
        await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    }
    for (const file of options.fileContents ?? []) {
        await routeSetup.setupStaticFileContent(file.urlPath, file.content);
    }
    await routeSetup.setupListHunksRequest(options.hunks);
    await routeSetup.setupDeleteHunkRequest();

    await page.goto(`/project/${uuid}`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(`/project/${uuid}`);
    await expect(
        page.getByRole('button', { name: 'Accept all' })
    ).toBeVisible();
}

async function expectFullPageHunkSnapshot(page: Page, name: string) {
    await expect(page).toHaveScreenshot(`${name}.png`, {
        animations: 'disabled',
        maxDiffPixels: 2000,
    });
}

test('hunk-add-empty-segment', async ({ page }) => {
    await openProjectWithHunks(page, {
        program: programOf(mdSegment(1, 'existing segment'), mdSegment(2, '')),
        hunks: [{ id: 'hunk-add-segment', type: 'addSegment', segmentId: 2 }],
    });

    await expect(page.locator('.segment-hunk-block--new')).toBeVisible();
    await expectFullPageHunkSnapshot(page, 'hunk-add-empty-segment');
});

test('hunk-add-segment-with-text', async ({ page }) => {
    const newText = 'New segment from hunk';
    await openProjectWithHunks(page, {
        program: programOf(
            mdSegment(1, 'existing segment'),
            mdSegment(2, newText)
        ),
        hunks: [
            { id: 'hunk-add-segment', type: 'addSegment', segmentId: 2 },
            {
                id: 'hunk-add-lines',
                type: 'addLinesToSegment',
                segmentId: 2,
                startLine: 1,
                endLine: 1,
                text: newText,
            },
        ],
    });

    await expect(page.locator('.segment-hunk-block--new')).toBeVisible();
    await expect(
        page.locator('#ide-segment-1').getByText(newText)
    ).toBeVisible();
    await expectFullPageHunkSnapshot(page, 'hunk-add-segment-with-text');
});

test('hunk-add-line-to-existing-segment', async ({ page }) => {
    await openProjectWithHunks(page, {
        program: programOf(mdSegment(1, 'existing line\nadded line')),
        hunks: [
            {
                id: 'hunk-add-line',
                type: 'addLinesToSegment',
                segmentId: 1,
                startLine: 2,
                endLine: 2,
                text: 'added line',
            },
        ],
    });

    await expect(page.locator('.cm-hunk-added-line')).toBeVisible();
    await expectFullPageHunkSnapshot(page, 'hunk-add-line-to-existing-segment');
});

test('hunk-add-lines-begin-middle-end', async ({ page }) => {
    const original = numberedLines(LINE_COUNT).split('\n');
    const newText = [
        'BEGIN',
        ...original.slice(0, 8),
        'MIDDLE',
        ...original.slice(8),
        'END',
    ].join('\n');

    await openProjectWithHunks(page, {
        program: programOf(mdSegment(1, newText)),
        hunks: [
            {
                id: 'hunk-begin',
                type: 'addLinesToSegment',
                segmentId: 1,
                startLine: 1,
                endLine: 1,
                text: 'BEGIN',
            },
            {
                id: 'hunk-middle',
                type: 'addLinesToSegment',
                segmentId: 1,
                startLine: 10,
                endLine: 10,
                text: 'MIDDLE',
            },
            {
                id: 'hunk-end',
                type: 'addLinesToSegment',
                segmentId: 1,
                startLine: 20,
                endLine: 20,
                text: 'END',
            },
        ],
    });

    await expect(page.locator('.cm-hunk-added-line')).toHaveCount(3);
    await expectFullPageHunkSnapshot(page, 'hunk-add-lines-begin-middle-end');
});

test('hunk-add-penultimate-line', async ({ page }) => {
    const original = numberedLines(LINE_COUNT).split('\n');
    const newText = [
        ...original.slice(0, 16),
        'PENULTIMATE',
        original[16],
    ].join('\n');

    await openProjectWithHunks(page, {
        program: programOf(mdSegment(1, newText)),
        hunks: [
            {
                id: 'hunk-penultimate',
                type: 'addLinesToSegment',
                segmentId: 1,
                startLine: 17,
                endLine: 17,
                text: 'PENULTIMATE',
            },
        ],
    });

    await expect(page.locator('.cm-hunk-added-line')).toBeVisible();
    await expectFullPageHunkSnapshot(page, 'hunk-add-penultimate-line');
});

test('hunk-add-multiline-line', async ({ page }) => {
    await openProjectWithHunks(page, {
        program: programOf(mdSegment(1, `keep\n${MULTILINE_TEXT}`)),
        hunks: [
            {
                id: 'hunk-multiline-add',
                type: 'addLinesToSegment',
                segmentId: 1,
                startLine: 2,
                endLine: 4,
                text: MULTILINE_TEXT,
            },
        ],
    });

    await expect(page.locator('.cm-hunk-added-line')).toHaveCount(3);
    await expectFullPageHunkSnapshot(page, 'hunk-add-multiline-line');
});

test('hunk-delete-multiline-line', async ({ page }) => {
    await openProjectWithHunks(page, {
        program: programOf(mdSegment(1, 'keep start\nkeep end')),
        hunks: [
            {
                id: 'hunk-multiline-delete',
                type: 'deleteLinesFromSegment',
                segmentId: 1,
                startLine: 2,
                endLine: 4,
                text: MULTILINE_TEXT,
            },
        ],
    });

    await expect(page.locator('.cm-hunk-deleted-line')).toHaveCount(3);
    await expectFullPageHunkSnapshot(page, 'hunk-delete-multiline-line');
});

test('hunk-delete-first-middle-last-lines', async ({ page }) => {
    const remaining = numberedLines(LINE_COUNT)
        .split('\n')
        .filter((line) => line !== '1' && line !== '9' && line !== '17')
        .join('\n');

    await openProjectWithHunks(page, {
        program: programOf(mdSegment(1, remaining)),
        hunks: [
            {
                id: 'hunk-delete-first',
                type: 'deleteLinesFromSegment',
                segmentId: 1,
                startLine: 1,
                endLine: 1,
                text: '1',
            },
            {
                id: 'hunk-delete-middle',
                type: 'deleteLinesFromSegment',
                segmentId: 1,
                startLine: 8,
                endLine: 8,
                text: '9',
            },
            {
                id: 'hunk-delete-last',
                type: 'deleteLinesFromSegment',
                segmentId: 1,
                startLine: 15,
                endLine: 15,
                text: '17',
            },
        ],
    });

    await expect(page.locator('.cm-hunk-deleted-line')).toHaveCount(3);
    await expectFullPageHunkSnapshot(
        page,
        'hunk-delete-first-middle-last-lines'
    );
});

test('hunk-replace-first-middle-last-lines', async ({ page }) => {
    const original = numberedLines(LINE_COUNT).split('\n');
    const replacements: Record<number, string> = {
        1: 'FIRST',
        9: 'MIDDLE',
        17: 'LAST',
    };
    const newText = original
        .map((line, index) => replacements[index + 1] ?? line)
        .join('\n');

    await openProjectWithHunks(page, {
        program: programOf(mdSegment(1, newText)),
        hunks: [1, 9, 17].flatMap((line) => [
            {
                id: `hunk-replace-delete-${line}`,
                type: 'deleteLinesFromSegment' as const,
                segmentId: 1,
                startLine: line,
                endLine: line,
                text: String(line),
            },
            {
                id: `hunk-replace-add-${line}`,
                type: 'addLinesToSegment' as const,
                segmentId: 1,
                startLine: line,
                endLine: line,
                text: replacements[line],
            },
        ]),
    });

    await expect(page.locator('.cm-hunk-deleted-line')).toHaveCount(3);
    await expect(page.locator('.cm-hunk-added-line')).toHaveCount(3);
    await expectFullPageHunkSnapshot(
        page,
        'hunk-replace-first-middle-last-lines'
    );
});

test('hunk-add-file', async ({ page }) => {
    const fileText = 'new file line 1\nnew file line 2';
    await openProjectWithHunks(page, {
        program: programOf(mdSegment(1, 'project')),
        hunks: [
            { id: 'hunk-add-file', type: 'addFile', fileName: 'notes.txt' },
            {
                id: 'hunk-add-file-lines',
                type: 'addLinesToFile',
                fileName: 'notes.txt',
                startLine: 1,
                endLine: 2,
                text: fileText,
            },
        ],
    });

    await page.locator('div.file-manager-button').click();
    await expect(page.getByText('notes.txt')).toBeVisible();
    await page.getByText('notes.txt').click();
    await expect(page.getByText('new file line 1')).toBeVisible();
    await expectFullPageHunkSnapshot(page, 'hunk-add-file');
});

test('hunk-delete-lines-from-file', async ({ page }) => {
    const fileOnDisk = numberedLines(LINE_COUNT);
    await openProjectWithHunks(page, {
        program: programOf(mdSegment(1, 'project')),
        hunks: [
            {
                id: 'hunk-delete-file-first',
                type: 'deleteLinesFromFile',
                fileName: 'notes.txt',
                startLine: 1,
                endLine: 1,
                text: '1',
            },
            {
                id: 'hunk-delete-file-middle',
                type: 'deleteLinesFromFile',
                fileName: 'notes.txt',
                startLine: 9,
                endLine: 9,
                text: '9',
            },
            {
                id: 'hunk-delete-file-last',
                type: 'deleteLinesFromFile',
                fileName: 'notes.txt',
                startLine: 17,
                endLine: 17,
                text: '17',
            },
        ],
        files: [{ fileName: 'notes.txt', url: '/files/notes.txt' }],
        fileContents: [{ urlPath: '/files/notes.txt', content: fileOnDisk }],
    });

    await page.locator('div.file-manager-button').click();
    await expect(page.getByText('notes.txt')).toBeVisible();
    await page.getByText('notes.txt').click();
    await expect(page.locator('.cm-hunk-deleted-line')).toHaveCount(3);
    await expectFullPageHunkSnapshot(page, 'hunk-delete-lines-from-file');
});
