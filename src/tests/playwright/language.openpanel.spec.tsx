import { expect, test, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';
import { PERSISTENCE_VERSION } from '../../view/store/persistMigrations.ts';

/** GH-250: язык интерфейса уходит в OpenPanel со стартом сессии и при каждой смене */

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';
const OPENPANEL_API = 'http://localhost:3000/gh250-openpanel';

test.use({ viewport: { width: 1360, height: 900 } });

type Tracked = { name: string; properties: Record<string, unknown> };

/** Редактор сохранил английский до первой загрузки */
async function seedEnglish(page: Page) {
    await page.addInitScript((version) => {
        if (window.sessionStorage.getItem('seeded')) {
            return;
        }
        window.sessionStorage.setItem('seeded', '1');
        window.localStorage.setItem('labkeeper_lang', 'en');
        window.localStorage.setItem(
            'persist:PERSISTENCE',
            JSON.stringify({
                language: JSON.stringify('en'),
                crossBorderConsentAcceptedLocally: 'true',
                _persist: JSON.stringify({ version, rehydrated: true }),
            })
        );
    }, PERSISTENCE_VERSION);
}

/** Страница отдаётся с ключами OpenPanel, а сам OpenPanel подменён: видно, что уходит */
async function trackOpenPanel(page: Page) {
    const tracked: Tracked[] = [];
    await page.route(`**/project/${uuid}**`, async (route) => {
        if (route.request().resourceType() !== 'document') {
            await route.fallback();
            return;
        }
        const response = await route.fetch();
        const html = (await response.text())
            .replace('IO_LABKEEPER_FRONTEND_OPENPANEL_CLIENT_ID', 'gh250')
            .replace('IO_LABKEEPER_FRONTEND_OPENPANEL_API_URL', OPENPANEL_API);
        await route.fulfill({ response, body: html });
    });
    await page.route(`${OPENPANEL_API}/**`, async (route) => {
        const body = route.request().postDataJSON() as {
            type?: string;
            payload?: { name?: string; properties?: Record<string, unknown> };
        } | null;
        if (body?.type === 'track' && body.payload?.name) {
            tracked.push({
                name: body.payload.name,
                properties: body.payload.properties ?? {},
            });
        }
        await route.fulfill({ json: {} });
    });
    return (name: string) =>
        tracked
            .filter((event) => event.name === `[E] ${name}`)
            .map((event) => event.properties);
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
}

const languageSelect = (page: Page) =>
    page.locator('.labkeeper_header__language');

test('language-reaches-openpanel-with-the-session-and-every-change', async ({
    page,
}) => {
    await seedEnglish(page);
    const named = await trackOpenPanel(page);
    await openProject(page);

    await expect
        .poll(() => named('Session started').map((event) => event.language))
        .toEqual(['en']);

    await languageSelect(page).locator('.select-header').click();
    await languageSelect(page).getByText('Русский').click();

    await expect
        .poll(() => named('Language changed'))
        .toEqual([expect.objectContaining({ from: 'en', to: 'ru' })]);

    // вошедший начинает сессию на каждой загрузке, и она уже на новом языке
    await page.reload();
    await expect
        .poll(() => named('Session started').map((event) => event.language))
        .toEqual(['en', 'ru']);
});
