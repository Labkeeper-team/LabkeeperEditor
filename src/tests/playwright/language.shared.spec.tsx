import { expect, test, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';
import { PERSISTENCE_VERSION } from '../../view/store/persistMigrations.ts';

/**
 * GH-175: язык общий у редактора и страниц сайта. Сайт хранит его в
 * localStorage под labkeeper_lang, и раньше редактор его не читал и не писал
 */

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

test.use({ viewport: { width: 1360, height: 900 } });

/** Состояние браузера до первой загрузки: что выбрано на сайте и что сохранил редактор */
async function seed(
    page: Page,
    { site, editor }: { site?: string; editor?: 'ru' | 'en' }
) {
    await page.addInitScript(
        ({ site, editor, version }) => {
            // только при первой загрузке: дальше хранилище ведёт само приложение
            if (window.sessionStorage.getItem('seeded')) {
                return;
            }
            window.sessionStorage.setItem('seeded', '1');
            if (site) {
                window.localStorage.setItem('labkeeper_lang', site);
            }
            if (editor) {
                window.localStorage.setItem(
                    'persist:PERSISTENCE',
                    JSON.stringify({
                        language: JSON.stringify(editor),
                        crossBorderConsentAcceptedLocally: 'true',
                        _persist: JSON.stringify({ version, rehydrated: true }),
                    })
                );
            }
        },
        { site, editor, version: PERSISTENCE_VERSION }
    );
}

async function openProject(page: Page) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest(true);
    await routeSetup.setupGetProjectRequest();
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    await routeSetup.setupAgentHistoryRequest([]);
    await page.goto(`/project/${uuid}`);
    await page.waitForLoadState('domcontentloaded');
}

const languageSelect = (page: Page) =>
    page.locator('.labkeeper_header__language');
const siteLanguage = (page: Page) =>
    page.evaluate(() => window.localStorage.getItem('labkeeper_lang'));

test('язык, выбранный на сайте, открывает редактор на нём же', async ({
    page,
}) => {
    await seed(page, { site: 'en', editor: 'ru' });

    await openProject(page);

    await expect(languageSelect(page)).toContainText('English');
    await expect(page.getByRole('tab', { name: 'AI agent' })).toBeVisible();
});

// шаги из задачи: английский, обратно русский, и сайт должен остаться на русском
test('смена языка в редакторе уходит сайту и переживает перезагрузку', async ({
    page,
}) => {
    await seed(page, { site: 'en', editor: 'en' });
    await openProject(page);

    await languageSelect(page).locator('.select-header').click();
    await languageSelect(page).getByText('Русский').click();

    await expect(languageSelect(page)).toContainText('Русский');
    await expect.poll(() => siteLanguage(page)).toBe('ru');

    await page.reload();

    await expect(languageSelect(page)).toContainText('Русский');
    expect(await siteLanguage(page)).toBe('ru');
});

test('без выбора на сайте сайту уходит язык редактора', async ({ page }) => {
    await seed(page, { editor: 'en' });

    await openProject(page);

    await expect(languageSelect(page)).toContainText('English');
    await expect.poll(() => siteLanguage(page)).toBe('en');
});
