import { expect, Page, test } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';

const userId = 1;
const existingProjectId = 'project-1-id';
const fixedLastModified = (() => {
    const now = new Date();
    const relative = new Date(
        now.getFullYear() - 2,
        now.getMonth(),
        now.getDate() - 1,
        12,
        0,
        0,
        0
    );
    return relative.toISOString();
})();
const contentType = 'application/json';

type ProjectTag = {
    name: string;
    color: string;
};

type ProjectTagsByProject = Record<string, ProjectTag[]>;

const seededProjectTagsByProject: ProjectTagsByProject = {
    'project-1-id': [
        { name: 'tag_1', color: 'blue' },
        { name: 'tag_2', color: 'orange' },
    ],
    'project-2-id': [{ name: 'tag_2', color: 'orange' }],
    'project-3-id': [
        { name: 'tag_1', color: 'blue' },
        { name: 'tag_3', color: 'red' },
    ],
};

const normalizeTags = (value: ProjectTag[] | undefined): ProjectTag[] => {
    const result: ProjectTag[] = [];
    for (const tag of value ?? []) {
        const name = tag.name.trim().replace(/\s+/g, ' ');
        if (!name) {
            continue;
        }
        result.push({ name, color: tag.color });
    }
    return result;
};

type ProjectsListItem = {
    projectId: string;
    userId: number;
    title: string;
    lastModified: string;
    projectType: 'markdown' | 'latex';
};

async function setupProjectsWithTagsApi(
    page: Page,
    projects: ProjectsListItem[],
    initialByProject: ProjectTagsByProject = {}
) {
    const state: ProjectTagsByProject = {};
    for (const project of projects) {
        state[project.projectId] = normalizeTags(
            initialByProject[project.projectId] ?? []
        );
    }

    await page.route('/api/v2/public/project/all', async (route) => {
        await route.fulfill({
            status: 200,
            contentType,
            body: JSON.stringify({
                projects: projects.map((project) => ({
                    ...project,
                    tags: state[project.projectId] ?? [],
                })),
            }),
        });
    });

    await page.route(
        /\/api\/v2\/public\/project\/[^/]+\/tags$/,
        async (route) => {
            const requestUrl = route.request().url();
            const match = /\/project\/([^/]+)\/tags$/.exec(requestUrl);
            const projectId = match?.[1];
            if (!projectId) {
                await route.fulfill({ status: 400, contentType, body: '{}' });
                return;
            }
            const rawBody = route.request().postData();
            const parsedBody = rawBody
                ? (JSON.parse(rawBody) as { tags?: ProjectTag[] })
                : {};
            state[projectId] = normalizeTags(parsedBody.tags);
            await route.fulfill({
                status: 200,
                contentType,
                body: '{}',
            });
        }
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
    await setupProjectsWithTagsApi(page, projects);

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
    await expect(projectRow.locator('.tag-chip')).toContainText('tag_1');

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
    await setupProjectsWithTagsApi(page, projects);

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
    await expect(project1Row.locator('.tag-chip')).toContainText([
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
    await expect(project2Row.locator('.tag-chip')).toContainText('tag_2');

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
    await expect(project3Row.locator('.tag-chip')).toContainText([
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

    await routeSetup.setupGetUserInfoRequest(true, 'a@gmail.com', userId, 0);
    await setupProjectsWithTagsApi(page, projects, seededProjectTagsByProject);

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

    await routeSetup.setupGetUserInfoRequest(true, 'a@gmail.com', userId, 0);
    await setupProjectsWithTagsApi(page, projects);

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
        projectRow.locator('.tag-chip').filter({ hasText: /^123$/ })
    ).toHaveCount(1);
    await expect(
        projectRow
            .locator('.tag-chip')
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

test('add-two-long-tag-names-and-filter-by-both', async ({ page }) => {
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

    const firstLongTag = 'aaaaaaaaaaaaaaaaaaaaaaaaaa';
    const secondLongTag = '12345678901234567890';

    await routeSetup.setupGetUserInfoRequest(true, 'a@gmail.com', userId, 0);
    await setupProjectsWithTagsApi(page, projects);

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
    await page.locator('.project-tags-input').fill(firstLongTag);
    await page.getByRole('button', { name: /Создать тег|Create tag/ }).click();
    await page.locator('.project-tags-input').fill(secondLongTag);
    await page.getByRole('button', { name: /Создать тег|Create tag/ }).click();

    await expect(
        projectRow
            .locator('.tag-chip')
            .filter({ hasText: /^aaaaaaaaaaaaaaaaaaaaaaaaaa$/ })
    ).toHaveCount(1);
    await expect(
        projectRow
            .locator('.tag-chip')
            .filter({ hasText: /^12345678901234567890$/ })
    ).toHaveCount(1);

    await expect(page).toHaveScreenshot(
        'projects-tags-long-names-step-1-added.png',
        {
            fullPage: true,
        }
    );

    await page.getByRole('button', { name: 'Close tags list' }).click();
    await page
        .getByRole('button', {
            name: /Фильтры по тегам|Tag filters|Tags filters/,
        })
        .click();
    await page
        .locator('.project-tags-filter-option')
        .filter({ hasText: firstLongTag })
        .click();
    await page
        .locator('.project-tags-filter-option')
        .filter({ hasText: secondLongTag })
        .click();

    await expect(page).toHaveScreenshot(
        'projects-tags-long-names-step-2-filter-selected.png',
        {
            fullPage: true,
        }
    );
});

test('remove-tags-from-first-project', async ({ page }) => {
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

    await routeSetup.setupGetUserInfoRequest(true, 'a@gmail.com', userId, 0);
    await setupProjectsWithTagsApi(page, projects);

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
    for (const tagName of ['tag_1', 'tag_2', 'tag_3']) {
        await page.locator('.project-tags-input').fill(tagName);
        await page
            .getByRole('button', { name: /Создать тег|Create tag/ })
            .click();
    }
    await page.getByRole('button', { name: 'Close tags list' }).click();

    await project2Row
        .getByRole('button', { name: /Редактировать теги|Edit tags/ })
        .click();
    await project2Row
        .locator('.project-tag-option')
        .filter({ hasText: 'tag_2' })
        .click();
    await page.getByRole('button', { name: 'Close tags list' }).click();

    await project3Row
        .getByRole('button', { name: /Редактировать теги|Edit tags/ })
        .click();
    await project3Row
        .locator('.project-tag-option')
        .filter({ hasText: 'tag_3' })
        .click();
    await page.getByRole('button', { name: 'Close tags list' }).click();

    await expect(project1Row.locator('.tag-chip')).toContainText([
        'tag_1',
        'tag_2',
        'tag_3',
    ]);
    await expect(project2Row.locator('.tag-chip')).toContainText('tag_2');
    await expect(project3Row.locator('.tag-chip')).toContainText('tag_3');

    await expect(page).toHaveScreenshot(
        'projects-tags-remove-step-1-before-delete.png',
        {
            fullPage: true,
        }
    );

    await project1Row
        .getByRole('button', { name: /Редактировать теги|Edit tags/ })
        .click();
    await project1Row
        .locator('.project-tag-option')
        .filter({ hasText: 'tag_1' })
        .click();
    await project1Row
        .locator('.project-tag-option')
        .filter({ hasText: 'tag_2' })
        .click();
    await project1Row
        .locator('.project-tag-option')
        .filter({ hasText: 'tag_3' })
        .click();

    await expect(project1Row.locator('.tag-chip')).toHaveCount(0);

    await expect(page).toHaveScreenshot(
        'projects-tags-remove-step-2-after-delete.png',
        {
            fullPage: true,
        }
    );
});

test('cycle-tag-colors', async ({ page }) => {
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
    await setupProjectsWithTagsApi(page, projects);

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
    await projectRow.locator('.project-tags-input').fill('blue');
    await projectRow
        .getByRole('button', { name: /Создать тег|Create tag/ })
        .click();
    await expect(projectRow.locator('.tag-chip')).toContainText('blue');

    await projectRow
        .getByRole('button', { name: 'Open color palette' })
        .click();
    await expect(page).toHaveScreenshot(
        'projects-tags-colors-step-1-open-panel.png',
        {
            fullPage: true,
        }
    );

    await projectRow.locator('.project-tags-color-input-text').fill('yellow');
    await projectRow.locator('.project-tags-color-input-text').press('Enter');
    await expect(page).toHaveScreenshot(
        'projects-tags-colors-step-2-typed-yellow.png',
        {
            fullPage: true,
        }
    );

    await projectRow.locator('.project-tags-input').fill('yellow');
    await projectRow
        .getByRole('button', { name: /Создать тег|Create tag/ })
        .click();
    await expect(
        projectRow.locator('.tag-chip').filter({ hasText: /^yellow$/ })
    ).toHaveCount(1);
    // Create-tag click is inside the tags modal, so the color panel closes.
    await projectRow
        .getByRole('button', { name: 'Open color palette' })
        .click();
    await expect(page).toHaveScreenshot(
        'projects-tags-colors-step-3-added-yellow.png',
        {
            fullPage: true,
        }
    );

    await projectRow.locator('.project-tags-color-input-text').fill('brown');
    await projectRow.locator('.project-tags-color-input-text').press('Enter');
    await expect(page).toHaveScreenshot(
        'projects-tags-colors-step-4-typed-brown.png',
        {
            fullPage: true,
        }
    );

    await projectRow.locator('.project-tags-input').fill('brown');
    await projectRow
        .getByRole('button', { name: /Создать тег|Create tag/ })
        .click();
    await expect(
        projectRow.locator('.tag-chip').filter({ hasText: /^brown$/ })
    ).toHaveCount(1);
    await projectRow
        .getByRole('button', { name: 'Open color palette' })
        .click();
    await expect(page).toHaveScreenshot(
        'projects-tags-colors-step-5-added-brown.png',
        {
            fullPage: true,
        }
    );
});

test('color-panel-swatch-and-input-values', async ({ page }) => {
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
    await setupProjectsWithTagsApi(page, projects);

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
    await projectRow
        .getByRole('button', { name: 'Open color palette' })
        .click();

    await projectRow
        .getByRole('button', { name: 'Set tag color deeppink' })
        .click();
    await expect(page).toHaveScreenshot(
        'projects-tags-colors-input-step-1-deeppink.png',
        {
            fullPage: true,
        }
    );

    const colorInput = projectRow.locator('.project-tags-color-input-text');
    await colorInput.fill('#FF0000');
    await colorInput.press('Enter');
    await expect(page).toHaveScreenshot(
        'projects-tags-colors-input-step-2-hex-red-entered.png',
        {
            fullPage: true,
        }
    );

    await colorInput.fill('abracadabra');
    await expect(page).toHaveScreenshot(
        'projects-tags-colors-input-step-3-invalid-text-typed.png',
        {
            fullPage: true,
        }
    );

    await colorInput.press('Enter');
    await expect(page).toHaveScreenshot(
        'projects-tags-colors-input-step-4-invalid-text-entered.png',
        {
            fullPage: true,
        }
    );
});
