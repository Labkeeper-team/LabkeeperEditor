import { expect, test, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';

/** Модуль страницы проекта: в сборке это project-*.js, на сервере разработки сам index.tsx */
const isProjectChunk = (url: URL) =>
    /\/src\/view\/pages\/project\/index\.tsx$/.test(url.pathname) ||
    /\/assets\/project-[^/]+\.js$/.test(url.pathname);

async function mockProject(page: Page) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest(true);
    await routeSetup.setupGetDefaultProjectRequest();
    await routeSetup.setupGetProjectRequest();
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest(200, 'default');
    await routeSetup.setupListFilesRequest(200, 'default');
}

/** Обрывает первые lost загрузок модуля страницы, как обрыв сети на телефоне */
async function loseProjectChunk(page: Page, lost: number) {
    const requests = { count: 0 };
    await page.route(isProjectChunk, async (route) => {
        requests.count += 1;
        if (requests.count <= lost) {
            await route.abort('internetdisconnected');
            return;
        }
        await route.fallback();
    });
    return requests;
}

// Bugsink: на телефоне не догрузился чанк страницы проекта, и вместо редактора
// осталась страница ошибки. Теперь страница один раз перезагружается сама
test('a project chunk lost once is loaded again after a reload', async ({
    page,
}) => {
    await mockProject(page);
    const requests = await loseProjectChunk(page, 1);

    await page.goto('/');

    await expect(page.locator('.ide-header')).toBeVisible({ timeout: 15000 });
    expect(requests.count).toBe(2);
});

test('a project chunk lost twice ends on the error page without a reload loop', async ({
    page,
}) => {
    await mockProject(page);
    const requests = await loseProjectChunk(page, Infinity);

    await page.goto('/');
    await expect.poll(() => requests.count).toBe(2);
    // перезагрузка была одна: третьего запроса нет и после паузы
    await page.waitForTimeout(3000);

    expect(requests.count).toBe(2);
    await expect(page.locator('.ide-header')).toHaveCount(0);
});
