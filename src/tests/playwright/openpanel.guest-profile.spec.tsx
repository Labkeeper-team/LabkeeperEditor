import { expect, test, type BrowserContext } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';

const OPENPANEL_API = 'http://localhost:3000/gh197-openpanel';

type Sent = {
    type: string;
    payload: { name?: string; profileId?: string; firstName?: string };
};

/**
 * GH-197: страница отдаётся с ключами OpenPanel, а сам OpenPanel подменён. Видно каждый
 * запрос и его профиль: запрос без profileId сервер пишет на deviceId, и так появляется
 * безымянный профиль Anonymous. Маршруты на контексте, чтобы их видела и вторая вкладка.
 */
async function captureOpenPanel(context: BrowserContext) {
    const sent: Sent[] = [];
    await context.route('**/project/default**', async (route) => {
        if (route.request().resourceType() !== 'document') {
            await route.fallback();
            return;
        }
        const response = await route.fetch();
        const html = (await response.text())
            .replace('IO_LABKEEPER_FRONTEND_OPENPANEL_CLIENT_ID', 'gh197')
            .replace('IO_LABKEEPER_FRONTEND_OPENPANEL_API_URL', OPENPANEL_API);
        await route.fulfill({ response, body: html });
    });
    await context.route(`${OPENPANEL_API}/**`, async (route) => {
        const body = route.request().postDataJSON() as Sent | null;
        if (body) {
            sent.push(body);
        }
        await route.fulfill({
            json: { deviceId: 'device-1', sessionId: 'server-1' },
        });
    });
    return {
        sent,
        named: (name: string) =>
            sent.filter(
                (body) =>
                    body.type === 'track' && body.payload.name === `[E] ${name}`
            ),
        profiles: () => [
            ...new Set(sent.map((body) => body.payload.profileId)),
        ],
    };
}

test('a-direct-guest-visit-sends-everything-as-one-named-guest', async ({
    page,
    context,
}) => {
    const openPanel = await captureOpenPanel(context);
    await new RouteSetup(page).setupGetUserInfoRequest(false);

    await page.goto('/project/default');

    await expect.poll(() => openPanel.named('Session started').length).toBe(1);
    await expect
        .poll(() =>
            openPanel.sent.some(
                (body) =>
                    body.type === 'identify' &&
                    /^anonymous\d{6}$/.test(body.payload.firstName ?? '')
            )
        )
        .toBe(true);
    // первым на сервер приходит page view, и он уже с профилем гостя
    expect(openPanel.sent[0].payload.name).toBe('[E] Page viewed');
    expect(openPanel.profiles()).toHaveLength(1);
    expect(openPanel.profiles()[0]).toMatch(/^[0-9A-Za-z]+$/);
});

// вкладка без копии sessionStorage, как пример с лендинга через target="_blank"
test('a-second-tab-continues-the-guest-without-a-second-start', async ({
    page,
    context,
}) => {
    const openPanel = await captureOpenPanel(context);
    await new RouteSetup(page).setupGetUserInfoRequest(false);
    await page.goto('/project/default');
    await expect.poll(() => openPanel.named('Session started').length).toBe(1);
    const identifies = () =>
        openPanel.sent.filter((body) => body.type === 'identify').length;
    const firstTab = identifies();

    const second = await context.newPage();
    await new RouteSetup(second).setupGetUserInfoRequest(false);
    await second.goto('/project/default');

    // вторая вкладка дошла до init и представилась: всё её уже в сети.
    // Page view бывает и не один: проект по умолчанию меняет адрес
    await expect.poll(identifies).toBeGreaterThan(firstTab);
    await second.waitForLoadState('networkidle');
    expect(openPanel.named('Page viewed').length).toBeGreaterThanOrEqual(2);
    expect(openPanel.named('Session started')).toHaveLength(1);
    expect(openPanel.profiles()).toHaveLength(1);
});

test('without-user-info-the-page-view-still-goes-to-a-guest', async ({
    page,
    context,
}) => {
    const openPanel = await captureOpenPanel(context);
    await page.route('**/api/*/public/user-info**', (route) =>
        route.fulfill({ status: 500, body: '' })
    );

    await page.goto('/project/default');

    await expect
        .poll(() => openPanel.named('Page viewed').length)
        .toBeGreaterThan(0);
    expect(openPanel.profiles()).toHaveLength(1);
    expect(openPanel.profiles()[0]).toMatch(/^[0-9A-Za-z]+$/);
});

// согласованное отличие от задачи: у вошедшего гостевой профиль не появляется вовсе
test('a-signed-in-visit-sends-everything-as-the-user', async ({
    page,
    context,
}) => {
    const openPanel = await captureOpenPanel(context);
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest(true);
    await routeSetup.acceptCrossBorderConsentLocally();
    await routeSetup.setupGetDefaultProjectRequest();
    await routeSetup.setupGetAllProjectsRequest();

    await page.goto('/project/default');

    await expect.poll(() => openPanel.named('Session started').length).toBe(1);
    expect(openPanel.profiles()).toEqual(['1']);
});
