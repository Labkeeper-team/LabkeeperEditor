import { expect, test } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';
import { Program } from '../../model/domain.ts';

/**
 * GH-228: картинка из дерева файлов открывается в редакторе. WebP уходил
 * ссылкой в новую вкладку браузера, хотя PNG рядом открывался на месте
 */

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

// прозрачная картинка 1×1: браузеру важен ответ, а не расширение в адресе
const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64'
);

const emptyProgram = {
    segments: [],
    parameters: { roundStrategy: 'noRound' },
} as unknown as Program;

test.use({ viewport: { width: 1360, height: 900 } });

for (const fileName of ['photo.webp', 'Scan.WEBP', 'figure.png']) {
    test(`${fileName} открывается в редакторе, а не в новой вкладке`, async ({
        page,
        context,
    }) => {
        const url = `/files/${fileName}`;
        const routeSetup = new RouteSetup(page);
        await routeSetup.setupGetUserInfoRequest();
        await routeSetup.setupGetProjectRequest(200, 'default', emptyProgram);
        await routeSetup.setupGetAllProjectsRequest();
        await routeSetup.setupSaveProgramRequest();
        await routeSetup.setupListFilesCustom([{ fileName, url }]);
        await page.route(
            (address) => address.pathname === url,
            (route) => route.fulfill({ contentType: 'image/png', body: PNG })
        );
        const tabs: string[] = [];
        context.on('page', (tab) => tabs.push(tab.url()));

        await page.goto(`/project/${uuid}`);
        await page.waitForLoadState('domcontentloaded');
        await page.locator('div.file-manager-button').click();
        await page.getByText(fileName, { exact: true }).click();

        const image = page.locator('.image-file-preview-image');
        await expect(image).toHaveAttribute('src', url);
        await expect
            .poll(() =>
                image.evaluate((img: HTMLImageElement) => img.naturalWidth)
            )
            .toBeGreaterThan(0);
        expect(tabs).toEqual([]);
    });
}
