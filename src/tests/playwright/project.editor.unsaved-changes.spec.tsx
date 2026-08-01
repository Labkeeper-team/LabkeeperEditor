import { type Dialog, expect, test } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

test('unsaved-changes-alert-until-latest-save', async ({ page }) => {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest();
    await routeSetup.setupGetDefaultProjectRequest();
    await routeSetup.setupGetProjectRequest();
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');

    let releaseFirstSave: () => void = () => undefined;
    const firstSaveCanFinish = new Promise<void>((resolve) => {
        releaseFirstSave = resolve;
    });
    let releaseSecondSave: () => void = () => undefined;
    const secondSaveCanFinish = new Promise<void>((resolve) => {
        releaseSecondSave = resolve;
    });
    let saveRequests = 0;
    await page.route(
        `**/api/*/public/project/${uuid}/program`,
        async (route) => {
            saveRequests += 1;
            await (saveRequests === 1
                ? firstSaveCanFinish
                : secondSaveCanFinish);
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: '{}',
            });
        }
    );

    await page.goto('/');
    await expect(page).toHaveURL(`/project/${uuid}`);

    await page
        .locator('.labkeeper_select.computation .select-header')
        .first()
        .click();
    await page
        .getByRole('listitem')
        .filter({ hasText: /^Markdown$/i })
        .click();
    const editor = page.locator('.cm-content').first();
    await editor.click();
    await editor.pressSequentially('unsaved');
    await expect.poll(() => saveRequests).toBe(1);
    await expect(page.locator('.save-status .ide-clone-spinner')).toBeVisible();
    await editor.pressSequentially(' latest');

    let beforeUnloadDialogs = 0;
    page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('beforeunload');
        beforeUnloadDialogs += 1;
        await dialog.dismiss();
    });
    await page.evaluate(() => window.location.reload());
    await expect.poll(() => beforeUnloadDialogs).toBe(1);

    const firstSaveResponse = page.waitForResponse((response) =>
        response.url().endsWith(`/public/project/${uuid}/program`)
    );
    releaseFirstSave();
    await firstSaveResponse;
    await expect.poll(() => saveRequests).toBe(2);

    page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('beforeunload');
        beforeUnloadDialogs += 1;
        await dialog.dismiss();
    });
    await page.evaluate(() => window.location.reload());
    await expect.poll(() => beforeUnloadDialogs).toBe(2);

    const secondSaveResponse = page.waitForResponse((response) =>
        response.url().endsWith(`/public/project/${uuid}/program`)
    );
    releaseSecondSave();
    await secondSaveResponse;
    await expect(page.locator('.save-status .ide-clone-spinner')).toHaveCount(
        0
    );

    const unexpectedDialogs: string[] = [];
    const collectUnexpectedDialog = async (dialog: Dialog) => {
        unexpectedDialogs.push(dialog.type());
        await dialog.accept();
    };
    page.on('dialog', collectUnexpectedDialog);
    await page.reload();
    page.off('dialog', collectUnexpectedDialog);

    expect(unexpectedDialogs).toEqual([]);
});
