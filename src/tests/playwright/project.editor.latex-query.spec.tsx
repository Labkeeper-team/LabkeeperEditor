import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { Program } from '../../model/domain.ts';
import { PERSISTENCE_VERSION } from '../../view/store/persistMigrations.ts';
import { RouteSetup } from './mock.routeSetUp.tsx';

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';
const pdf = readFileSync(
    new URL('./fixtures/pdf-links-selection.pdf', import.meta.url)
);

test.beforeEach(async ({ page }) => {
    await page.route('**/files/query.pdf', (route) =>
        route.fulfill({ contentType: 'application/pdf', body: pdf })
    );
});

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
    await expectSegmentText(fields.nth(1), '% Labkeeper: query latex\nE=mc^2');
    await expect
        .poll(() =>
            compiled.map((program) =>
                program.segments.map((segment) => segment.text)
            )
        )
        .toEqual([['черновик', '% Labkeeper: query latex\nE=mc^2']]);
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
    await expectSegmentText(fields, '% Labkeeper: query latex\n\\alpha+\\beta');
    await expect.poll(() => compiled.length).toBe(1);
    expect(compiled[0].segments.map((segment) => segment.text)).toEqual([
        '% Labkeeper: query latex\n\\alpha+\\beta',
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
                    pdfUri: '/files/query.pdf',
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
    await expect.poll(() => compiledProject).toBe(true);
    expect(saved.length).toBeGreaterThan(0);
    // Автосохранение при смене фокуса может отправить тот же документ повторно.
    for (const program of saved) {
        expect(program.segments.map((segment) => segment.text)).toEqual([
            'черновик',
            'E=mc^2',
        ]);
    }
});

test('compute-latex-markdown-params-appear-in-that-order', async ({ page }) => {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupApi();
    await routeSetup.setupGetUserInfoRequest(false);
    const compiled = await captureGuestCompile(page);

    await page.goto(
        `/?compute=${encodeURIComponent('a = 1')}&latex=${encodeURIComponent('E=mc^2')}&markdown=${encodeURIComponent('текст')}`
    );

    const fields = editors(page);
    await expect(fields).toHaveCount(3, { timeout: 30_000 });
    await expectSegmentText(
        fields.nth(0),
        '// Labkeeper: query compute\na = 1'
    );
    await expectSegmentText(fields.nth(1), '% Labkeeper: query latex\nE=mc^2');
    await expectSegmentText(
        fields.nth(2),
        '<!-- Labkeeper: query markdown -->\nтекст'
    );
    await expect.poll(() => compiled.length).toBe(1);
    expect(
        compiled[0]?.segments.map((segment) => ({
            type: segment.type,
            text: segment.text,
        }))
    ).toEqual([
        { type: 'computational', text: '// Labkeeper: query compute\na = 1' },
        { type: 'latex', text: '% Labkeeper: query latex\nE=mc^2' },
        { type: 'md', text: '<!-- Labkeeper: query markdown -->\nтекст' },
    ]);
});

async function savedDraft(page: Page): Promise<Program> {
    return page.evaluate(() => {
        const persisted = JSON.parse(
            localStorage.getItem('persist:PERSISTENCE')!
        );
        return JSON.parse(persisted.lastProgram);
    });
}

for (const [key, comment] of [
    ['compute', '// Labkeeper: query compute'],
    ['latex', '% Labkeeper: query latex'],
    ['markdown', '<!-- Labkeeper: query markdown -->'],
]) {
    test(
        'guest replaces the previous ' +
            key +
            ' example and persists the result',
        async ({ page }) => {
            const routeSetup = new RouteSetup(page);
            await routeSetup.setupApi();
            await routeSetup.setupGetUserInfoRequest(false);
            const compiled = await captureGuestCompile(page);
            await seedSavedProgram(page, savedProgram);

            for (const [index, value] of [
                'first',
                'second',
                'second',
            ].entries()) {
                const query = new URLSearchParams({
                    open: 'latex',
                    [key]: value,
                });
                await page.goto('/project/default?' + query);
                await expect(editors(page)).toHaveCount(2, { timeout: 30_000 });
                await expect(editors(page).first()).toHaveText('черновик');
                await expectSegmentText(
                    editors(page).last(),
                    comment + '\n' + value
                );
                await expect
                    .poll(async () =>
                        (await savedDraft(page)).segments.map((s) => s.text)
                    )
                    .toEqual(['черновик', comment + '\n' + value]);
                await expect.poll(() => compiled.length).toBe(index + 1);
                await expect(page).toHaveURL(/\/project\/default$/);
            }
            await expect.poll(() => compiled.length).toBe(3);
            expect(compiled.map((p) => p.segments.map((s) => s.text))).toEqual([
                ['черновик', comment + '\nfirst'],
                ['черновик', comment + '\nsecond'],
                ['черновик', comment + '\nsecond'],
            ]);
            await page.reload();
            await expect(editors(page)).toHaveCount(2);
            await expectSegmentText(editors(page).last(), comment + '\nsecond');
        }
    );
}

test('guest switches between example types without keeping old marked segments', async ({
    page,
}) => {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupApi();
    await routeSetup.setupGetUserInfoRequest(false);
    const compiled = await captureGuestCompile(page);
    await seedSavedProgram(page, savedProgram);

    const examples = [
        { compute: 'x = 2', latex: '\\[x=${x}\\]', markdown: '# Result' },
        {
            latex: '\\documentclass{article}\n\\begin{document}\nNew example\n\\end{document}',
        },
        { markdown: '# Another example' },
        { compute: 'y = 3' },
    ];
    const expectedTexts = [
        [
            'черновик',
            '// Labkeeper: query compute\nx = 2',
            '% Labkeeper: query latex\n\\[x=${x}\\]',
            '<!-- Labkeeper: query markdown -->\n# Result',
        ],
        [
            'черновик',
            '% Labkeeper: query latex\n\\documentclass{article}\n\\begin{document}\nNew example\n\\end{document}',
        ],
        ['черновик', '<!-- Labkeeper: query markdown -->\n# Another example'],
        ['черновик', '// Labkeeper: query compute\ny = 3'],
    ];
    for (const [index, example] of examples.entries()) {
        const query = new URLSearchParams({ open: 'latex' });
        for (const [key, value] of Object.entries(example)) {
            query.set(key, value);
        }
        await page.goto('/project/default?' + query);
        await expect(editors(page)).toHaveCount(expectedTexts[index].length, {
            timeout: 30_000,
        });
        for (const [position, text] of expectedTexts[index].entries()) {
            await expectSegmentText(editors(page).nth(position), text);
        }
        await expect
            .poll(async () =>
                (await savedDraft(page)).segments.map((segment) => segment.text)
            )
            .toEqual(expectedTexts[index]);
        await expect.poll(() => compiled.length).toBe(index + 1);
    }
    expect(compiled.map((p) => p.segments.map((s) => s.text))).toEqual(
        expectedTexts
    );
    await page.reload();
    await expect(editors(page)).toHaveCount(2);
    await expectSegmentText(editors(page).last(), expectedTexts[3][1]);
});

test('guest keeps an edited example after removing its marker', async ({
    page,
}) => {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupApi();
    await routeSetup.setupGetUserInfoRequest(false);
    await captureGuestCompile(page);
    await page.goto('/project/default?latex=first');
    await expect(editors(page)).toHaveCount(1);
    await expectSegmentText(editors(page), '% Labkeeper: query latex\nfirst');
    await editors(page).click();
    const selectAll = await page.evaluate(() =>
        /Mac/.test(navigator.platform) ||
        /iPhone|iPad|iPod/.test(navigator.userAgent)
            ? 'Meta+a'
            : 'Control+a'
    );
    await editors(page).press(selectAll);
    await editors(page).press('Backspace');
    await expectSegmentText(editors(page), '');
    await page.keyboard.insertText('my saved work');
    await expectSegmentText(editors(page), 'my saved work');
    await editors(page).blur();
    await expect
        .poll(async () => (await savedDraft(page)).segments[0].text)
        .toBe('my saved work');

    await page.goto('/project/default?latex=second');
    await expect(editors(page)).toHaveCount(2);
    await expect(editors(page).first()).toHaveText('my saved work');
    await expectSegmentText(
        editors(page).last(),
        '% Labkeeper: query latex\nsecond'
    );
});
