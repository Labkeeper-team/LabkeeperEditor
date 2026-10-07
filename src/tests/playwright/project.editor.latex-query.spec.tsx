import { expect, test, type Page } from '@playwright/test';
import { Program } from '../../model/domain.ts';
import { PERSISTENCE_VERSION } from '../../view/store/persistMigrations.ts';
import { RouteSetup } from './mock.routeSetUp.tsx';

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

const savedProgram: Program = {
    segments: [
        {
            type: 'md',
            text: 'черновик',
            parameters: { visible: true },
        },
    ],
    parameters: { roundStrategy: 'threeDigits' },
};

async function seedSavedProgram(page: Page, program: Program) {
    await page.addInitScript(
        ({ stored, version }) => {
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

async function captureGuestCompile(page: Page) {
    const programs: Program[] = [];
    await page.route('**/api/v4/public/compile/pdf**', async (route) => {
        programs.push(route.request().postDataJSON() as Program);
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                pdfUri: 'https://files.example/out.pdf',
            }),
        });
    });
    return programs;
}

test('guest-with-a-saved-program-sees-the-latex-segment', async ({ page }) => {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupApi();
    await routeSetup.setupGetUserInfoRequest(false);
    const compiled = await captureGuestCompile(page);
    await seedSavedProgram(page, savedProgram);

    await page.goto(`/?latex=${encodeURIComponent('E=mc^2')}`);

    const fields = editors(page);
    await expect(fields).toHaveCount(2, { timeout: 30_000 });
    await expect(fields.nth(0)).toHaveText('черновик');
    await expect(fields.nth(1)).toHaveText('E=mc^2');
    expect(
        compiled.map((program) =>
            program.segments.map((segment) => segment.text)
        )
    ).toEqual([['черновик', 'E=mc^2']]);
});

test('guest-without-a-saved-program-sees-one-latex-segment', async ({
    page,
}) => {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupApi();
    await routeSetup.setupGetUserInfoRequest(false);
    const compiled = await captureGuestCompile(page);

    await page.goto(`/?latex=${encodeURIComponent('\\alpha+\\beta')}`);

    const fields = editors(page);
    await expect(fields).toHaveCount(1, { timeout: 30_000 });
    await expect(fields).toHaveText('\\alpha+\\beta');
    expect(compiled).toHaveLength(1);
    expect(compiled[0].segments.map((segment) => segment.text)).toEqual([
        '\\alpha+\\beta',
    ]);
});

test('signed-in-default-project-request-includes-the-latex-segment', async ({
    page,
}) => {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupApi();
    await routeSetup.setupGetUserInfoRequest(true);
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupListHunksRequest();
    await routeSetup.setupAgentHistoryRequest([]);
    await seedSavedProgram(page, savedProgram);

    const saved: Program[] = [];
    let compiledProject = false;
    await routeSetup.setupSaveProgramRequest(200, 'empty', (route) => {
        saved.push(route.request().postDataJSON() as Program);
    });
    await page.route(
        `**/api/v4/public/project/${uuid}/compile/pdf**`,
        async (route) => {
            compiledProject = true;
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    pdfUri: 'https://files.example/out.pdf',
                }),
            });
        }
    );

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

    await page.goto(`/?latex=${encodeURIComponent('E=mc^2')}`);

    const fields = editors(page);
    await expect(fields).toHaveCount(2, { timeout: 30_000 });
    expect(
        posted?.segments.map((segment) => ({
            type: segment.type,
            text: segment.text,
        }))
    ).toEqual([
        { type: 'md', text: 'черновик' },
        { type: 'latex', text: 'E=mc^2' },
    ]);
    await expect(fields.nth(0)).toHaveText('черновик');
    await expect(fields.nth(1)).toHaveText('E=mc^2');
    expect(
        saved.map((program) => program.segments.map((segment) => segment.text))
    ).toEqual([['черновик', 'E=mc^2']]);
    expect(compiledProject).toBe(true);
});
