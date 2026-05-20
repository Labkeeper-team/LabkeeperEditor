import { expect, Page, test } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';

const userId = 1;
const existingProjectId = 'project-1-id';
const fixedLastModified = '2024-03-20T12:00:00.000Z';
const contentType = 'application/json';
const tagsStorageKey = 'labkeeper-project-tags-v1';
const seededTagsStorage = JSON.stringify({
    projects: {
        'project-1-id': ['tag_1', 'tag_2'],
        'project-2-id': ['tag_2'],
        'project-3-id': ['tag_1', 'tag_3'],
    },
    tags: {
        tag_1: { label: 'tag_1', color: 'blue' },
        tag_2: { label: 'tag_2', color: 'orange' },
        tag_3: { label: 'tag_3', color: 'purple' },
    },
});

async function seedReadonlyStorageKey(
    page: Page,
    storageKey: string,
    seededValue: string
) {
    await page.addInitScript(
        ({ storageKey: key, seededValue: value }) => {
            const originalGetItem = Storage.prototype.getItem;
            const originalSetItem = Storage.prototype.setItem;
            const originalRemoveItem = Storage.prototype.removeItem;

            Storage.prototype.getItem = function (currentKey: string) {
                if (currentKey === key) {
                    return value;
                }
                return originalGetItem.call(this, currentKey);
            };

            Storage.prototype.setItem = function (
                currentKey: string,
                currentValue: string
            ) {
                if (currentKey === key) {
                    return;
                }
                return originalSetItem.call(this, currentKey, currentValue);
            };

            Storage.prototype.removeItem = function (currentKey: string) {
                if (currentKey === key) {
                    return;
                }
                return originalRemoveItem.call(this, currentKey);
            };

            window.localStorage.setItem(key, value);
        },
        { storageKey, seededValue }
    );
}

test('add-one-tag-for-one-project', async ({ page }) => {
    const routeSetup = new RouteSetup(page);
    const projects: Array<{
        projectId: string;
        userId: number;
        title: string;
        lastModified: string;
        projectType: 'markdown' | 'latex';
    }> = [
        {
            projectId: existingProjectId,
            userId,
            title: 'Project_1',
            lastModified: fixedLastModified,
            projectType: 'markdown',
        },
    ];

    await routeSetup.setupGetUserInfoRequest(true, 'a@gmail.com', userId, 0);

    await page.route('/api/v2/public/project/all', async (route) => {
        await route.fulfill({
            status: 200,
            contentType,
            body: JSON.stringify({ projects }),
        });
    });

    await page.goto('/projects');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL('/projects');

    const projectRow = page
        .locator('tr')
        .filter({ hasText: 'Project_1' })
        .first();
    await expect(projectRow).toBeVisible();

    await expect(page).toHaveScreenshot('projects-tag-step-1-before-open.png', {
        fullPage: true,
    });

    await projectRow
        .getByRole('button', { name: /Редактировать теги|Edit tags/ })
        .click();
    await page.locator('.project-tags-input').fill('tag_1');

    await expect(page).toHaveScreenshot(
        'projects-tag-step-2-open-and-typed.png',
        {
            fullPage: true,
        }
    );

    await page.getByRole('button', { name: /Создать тег|Create tag/ }).click();
    await expect(projectRow.locator('.project-tag-chip')).toContainText(
        'tag_1'
    );

    await expect(page).toHaveScreenshot('projects-tag-step-3-tag-added.png', {
        fullPage: true,
    });
});

test('edit-tags-across-three-projects', async ({ page }) => {
    const routeSetup = new RouteSetup(page);
    const projects: Array<{
        projectId: string;
        userId: number;
        title: string;
        lastModified: string;
        projectType: 'markdown' | 'latex';
    }> = [
        {
            projectId: 'project-1-id',
            userId,
            title: 'Project_1',
            lastModified: fixedLastModified,
            projectType: 'markdown',
        },
        {
            projectId: 'project-2-id',
            userId,
            title: 'Project_2',
            lastModified: fixedLastModified,
            projectType: 'markdown',
        },
        {
            projectId: 'project-3-id',
            userId,
            title: 'Project_3',
            lastModified: fixedLastModified,
            projectType: 'markdown',
        },
    ];

    await page.addInitScript((storageKey) => {
        window.localStorage.removeItem(storageKey);
    }, tagsStorageKey);

    await routeSetup.setupGetUserInfoRequest(true, 'a@gmail.com', userId, 0);
    await page.route(/\/api\/v\d+\/public\/user-info.*/, async (route) => {
        await route.fulfill({
            status: 200,
            contentType,
            body: JSON.stringify({
                isAuthenticated: true,
                email: 'a@gmail.com',
                id: userId,
                tokens: 0,
            }),
        });
    });

    await page.route('/api/v2/public/project/all', async (route) => {
        await route.fulfill({
            status: 200,
            contentType,
            body: JSON.stringify({ projects }),
        });
    });

    await page.goto('/projects');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL('/projects');
    await page
        .getByRole('button', { name: /Имя|Name/ })
        .first()
        .click();

    const project1Row = page
        .locator('tr')
        .filter({ hasText: 'Project_1' })
        .first();
    const project2Row = page
        .locator('tr')
        .filter({ hasText: 'Project_2' })
        .first();
    const project3Row = page
        .locator('tr')
        .filter({ hasText: 'Project_3' })
        .first();
    await expect(project1Row).toBeVisible();
    await expect(project2Row).toBeVisible();
    await expect(project3Row).toBeVisible();

    await project1Row
        .getByRole('button', { name: /Редактировать теги|Edit tags/ })
        .click();
    await page.locator('.project-tags-input').fill('tag_1');
    await page.getByRole('button', { name: /Создать тег|Create tag/ }).click();
    await page.locator('.project-tags-input').fill('tag_2');
    await page.getByRole('button', { name: /Создать тег|Create tag/ }).click();
    await expect(project1Row.locator('.project-tag-chip')).toContainText([
        'tag_1',
        'tag_2',
    ]);

    await expect(page).toHaveScreenshot(
        'projects-tags-three-projects-step-1.png',
        {
            fullPage: true,
        }
    );
    await page.getByRole('button', { name: 'Close tags list' }).click();

    await project2Row
        .getByRole('button', { name: /Редактировать теги|Edit tags/ })
        .click();
    await project2Row
        .locator('.project-tag-option')
        .filter({ hasText: 'tag_2' })
        .click();
    await expect(project2Row.locator('.project-tag-chip')).toContainText(
        'tag_2'
    );

    await expect(page).toHaveScreenshot(
        'projects-tags-three-projects-step-2.png',
        {
            fullPage: true,
        }
    );
    await page.getByRole('button', { name: 'Close tags list' }).click();

    await project3Row
        .getByRole('button', { name: /Редактировать теги|Edit tags/ })
        .click();
    await project3Row
        .locator('.project-tag-option')
        .filter({ hasText: 'tag_1' })
        .click();
    await page.locator('.project-tags-input').fill('tag_3');
    await page.getByRole('button', { name: /Создать тег|Create tag/ }).click();
    await expect(project3Row.locator('.project-tag-chip')).toContainText([
        'tag_1',
        'tag_3',
    ]);

    await expect(page).toHaveScreenshot(
        'projects-tags-three-projects-step-3.png',
        {
            fullPage: true,
        }
    );
});

test('filter-three-projects-by-tags', async ({ page }) => {
    const routeSetup = new RouteSetup(page);
    const projects: Array<{
        projectId: string;
        userId: number;
        title: string;
        lastModified: string;
        projectType: 'markdown' | 'latex';
    }> = [
        {
            projectId: 'project-1-id',
            userId,
            title: 'Project_1',
            lastModified: fixedLastModified,
            projectType: 'markdown',
        },
        {
            projectId: 'project-2-id',
            userId,
            title: 'Project_2',
            lastModified: fixedLastModified,
            projectType: 'markdown',
        },
        {
            projectId: 'project-3-id',
            userId,
            title: 'Project_3',
            lastModified: fixedLastModified,
            projectType: 'markdown',
        },
    ];

    await seedReadonlyStorageKey(page, tagsStorageKey, seededTagsStorage);

    await routeSetup.setupGetUserInfoRequest(true, 'a@gmail.com', userId, 0);

    await page.route('/api/v2/public/project/all', async (route) => {
        await route.fulfill({
            status: 200,
            contentType,
            body: JSON.stringify({ projects }),
        });
    });

    await page.goto('/projects');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL('/projects');
    await page
        .getByRole('button', { name: /Имя|Name/ })
        .first()
        .click();

    await expect(
        page
            .locator('tr')
            .filter({ hasText: /Project_1.*tag_1.*tag_2/ })
            .first()
    ).toBeVisible();
    await expect(
        page
            .locator('tr')
            .filter({ hasText: /Project_2.*tag_2/ })
            .first()
    ).toBeVisible();
    await expect(
        page
            .locator('tr')
            .filter({ hasText: /Project_3.*tag_1.*tag_3/ })
            .first()
    ).toBeVisible();

    await page
        .getByRole('button', {
            name: /Фильтры по тегам|Tag filters|Tags filters/,
        })
        .click();

    await expect(page).toHaveScreenshot(
        'projects-tags-filter-three-projects-step-1-menu-open.png',
        {
            fullPage: true,
        }
    );

    await page
        .locator('.project-tags-filter-option')
        .filter({ hasText: 'tag_1' })
        .click();

    await expect(page).toHaveScreenshot(
        'projects-tags-filter-three-projects-step-2-tag-1.png',
        {
            fullPage: true,
        }
    );

    await page
        .locator('.project-tags-filter-option')
        .filter({ hasText: 'tag_3' })
        .click();

    await expect(page).toHaveScreenshot(
        'projects-tags-filter-three-projects-step-3-tag-3.png',
        {
            fullPage: true,
        }
    );
});

test('add-many-tags', async ({ page }) => {
    const routeSetup = new RouteSetup(page);
    const projects: Array<{
        projectId: string;
        userId: number;
        title: string;
        lastModified: string;
        projectType: 'markdown' | 'latex';
    }> = [
        {
            projectId: existingProjectId,
            userId,
            title: 'Project_1',
            lastModified: fixedLastModified,
            projectType: 'markdown',
        },
    ];

    const longTagNames: string[] = [];
    let numericTag = '';
    for (let i = 1; i <= 13; i += 1) {
        numericTag += i.toString();
        if (i >= 3) {
            longTagNames.push(numericTag);
        }
    }

    await page.addInitScript((storageKey) => {
        window.localStorage.removeItem(storageKey);
    }, tagsStorageKey);

    await routeSetup.setupGetUserInfoRequest(true, 'a@gmail.com', userId, 0);

    await page.route('/api/v2/public/project/all', async (route) => {
        await route.fulfill({
            status: 200,
            contentType,
            body: JSON.stringify({ projects }),
        });
    });

    await page.goto('/projects');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL('/projects');

    const projectRow = page
        .locator('tr')
        .filter({ hasText: 'Project_1' })
        .first();
    await expect(projectRow).toBeVisible();

    await projectRow
        .getByRole('button', { name: /Редактировать теги|Edit tags/ })
        .click();

    for (const tagName of longTagNames) {
        await page.locator('.project-tags-input').fill(tagName);
        await page
            .getByRole('button', { name: /Создать тег|Create tag/ })
            .click();
    }

    await expect(
        projectRow.locator('.project-tag-chip').filter({ hasText: /^123$/ })
    ).toHaveCount(1);
    await expect(
        projectRow
            .locator('.project-tag-chip')
            .filter({ hasText: /^12345678910111213$/ })
    ).toHaveCount(1);

    await expect(page).toHaveScreenshot('projects-tags-many-tags.png', {
        fullPage: true,
    });

    await page
        .locator('.project-tags-scroll')
        .evaluate((element) => (element.scrollTop = element.scrollHeight));

    await expect(page).toHaveScreenshot(
        'projects-tags-many-tags-scrolled.png',
        {
            fullPage: true,
        }
    );

    await page.getByRole('button', { name: 'Close tags list' }).click();

    await projectRow.locator('.project-tags-cell').evaluate((element) => {
        element.scrollTop = element.scrollHeight;
        element.scrollLeft = element.scrollWidth;
    });

    await expect(page).toHaveScreenshot(
        'projects-tags-many-tags-after-close-scrolled.png',
        {
            fullPage: true,
        }
    );
});
