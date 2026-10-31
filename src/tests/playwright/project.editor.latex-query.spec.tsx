import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { Program } from '../../model/domain.ts';
import { PERSISTENCE_VERSION } from '../../view/store/persistMigrations.ts';
import { RouteSetup } from './mock.routeSetUp.tsx';

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';
const pdf = readFileSync(
    new URL('./fixtures/pdf-links-selection.pdf', import.meta.url)
);

const exampleProgram: Program = {
    parameters: { roundStrategy: 'threeDigits' },
    segments: [
        {
            id: 0,
            type: 'computational',
            text: 'a = 1',
            parameters: { visible: true, hideValue: true },
        },
        {
            id: 1,
            type: 'latex',
            text: 'E=mc^2',
            parameters: { visible: true, hideAssignment: true },
        },
        {
            id: 2,
            type: 'md',
            text: 'текст',
            parameters: { visible: true },
        },
    ],
};

const savedProgram: Program = {
    segments: [
        {
            type: 'md',
            text: 'черновик',
            parameters: { visible: true },
        },
    ],
    parameters: { roundStrategy: 'noRound' },
};

test.beforeEach(async ({ page }) => {
    await page.route('**/files/query.pdf', (route) =>
        route.fulfill({ contentType: 'application/pdf', body: pdf })
    );
});

async function mockExampleProgram(page: Page) {
    await page.route('**/api/v4/public/blog/*/program', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(exampleProgram),
        });
    });
}

async function seedSavedProgram(page: Page, program: Program) {
    await page.addInitScript(
        ({ stored, version }) => {
            if (window.localStorage.getItem('persist:PERSISTENCE')) return;
            window.localStorage.setItem(
                'persist:PERSISTENCE',
                JSON.stringify({
                    lastProgram: JSON.stringify(stored),
                    _persist: JSON.stringify({
                        version,
                        rehydrated: true,
                    }),
                })
            );
        },
        { stored: program, version: PERSISTENCE_VERSION }
    );
}

function editors(page: Page) {
    return page.locator('.segment-editor-container .cm-content');
}

async function expectSegmentText(field: Locator, text: string) {
    await expect(field.locator('.cm-line')).toHaveText(text.split('\n'));
}

async function captureGuestCompile(page: Page) {
    const programs: Program[] = [];
    await page.route('**/api/v4/public/compile/pdf**', async (route) => {
        programs.push(route.request().postDataJSON() as Program);
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                pdfUri: '/files/query.pdf',
            }),
        });
    });
    return programs;
}

test('guest example slug replaces the draft with the whole program', async ({
    page,
}) => {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupApi();
    await mockExampleProgram(page);
    await routeSetup.setupGetUserInfoRequest(false);
    const compiled = await captureGuestCompile(page);
    await seedSavedProgram(page, savedProgram);

    await page.goto('/project/default?example=many-segments');

    const fields = editors(page);
    await expect(fields).toHaveCount(3, { timeout: 30_000 });
    await expectSegmentText(fields.nth(0), 'a = 1');
    await expectSegmentText(fields.nth(1), 'E=mc^2');
    await expectSegmentText(fields.nth(2), 'текст');
    await expect.poll(() => compiled.length).toBe(1);
    expect(compiled[0].parameters).toEqual(exampleProgram.parameters);
    expect(
        compiled[0].segments.map(({ type, text, parameters }) => ({
            type,
            text,
            parameters,
        }))
    ).toEqual(
        exampleProgram.segments.map(({ type, text, parameters }) => ({
            type,
            text,
            parameters,
        }))
    );
});

test('code query params do not insert a segment', async ({ page }) => {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupApi();
    await routeSetup.setupGetUserInfoRequest(false);
    await captureGuestCompile(page);
    await seedSavedProgram(page, savedProgram);

    await page.goto(
        `/?compute=${encodeURIComponent('a = 1')}&latex=${encodeURIComponent('E=mc^2')}&markdown=${encodeURIComponent('текст')}`
    );

    const fields = editors(page);
    await expect(fields).toHaveCount(1, { timeout: 30_000 });
    await expect(fields).toHaveText('черновик');
});

test('signed-in example slug sends the whole program to the default project', async ({
    page,
}) => {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupApi();
    await mockExampleProgram(page);
    await routeSetup.setupGetUserInfoRequest(true);
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupListHunksRequest();
    await routeSetup.setupAgentHistoryRequest([]);
    await seedSavedProgram(page, savedProgram);

    let posted: Program | undefined;
    await page.route('**/api/v4/public/project/default**', async (route) => {
        posted = route.request().postDataJSON() as Program;
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                projectId: uuid,
                userId: 1,
                title: 'Default Project',
                lastModified: new Date().toISOString(),
                isPublic: false,
                program: posted,
                projectType: 'latex',
            }),
        });
    });

    await page.goto('/?example=many-segments');

    const fields = editors(page);
    await expect(fields).toHaveCount(3, { timeout: 30_000 });
    expect(posted?.parameters).toEqual(exampleProgram.parameters);
    expect(
        posted?.segments.map(({ type, text, parameters }) => ({
            type,
            text,
            parameters,
        }))
    ).toEqual(
        exampleProgram.segments.map(({ type, text, parameters }) => ({
            type,
            text,
            parameters,
        }))
    );
    await expectSegmentText(fields.nth(0), 'a = 1');
    await expectSegmentText(fields.nth(1), 'E=mc^2');
    await expectSegmentText(fields.nth(2), 'текст');
});
