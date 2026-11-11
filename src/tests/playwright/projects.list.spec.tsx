import { expect, test, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';

test.use({ viewport: { width: 1360, height: 900 } });

const PHYSICS = { name: 'Физика', color: '#4469e0' };
const THESIS = { name: 'Диплом', color: '#1ca852' };

const PROJECTS = [
    {
        projectId: '00000000-0000-4000-8000-000000000001',
        userId: 1,
        title: 'Лабораторная 2',
        lastModified: '2025-03-01T12:00:00Z',
        creationTime: '2024-05-01T12:00:00Z',
        isPublic: false,
        projectType: 'latex',
        tags: [PHYSICS],
    },
    {
        projectId: '00000000-0000-4000-8000-000000000002',
        userId: 1,
        title: 'Лабораторная 10',
        lastModified: '2025-01-01T12:00:00Z',
        creationTime: '2024-09-01T12:00:00Z',
        isPublic: true,
        projectType: 'latex',
        tags: [PHYSICS, THESIS],
    },
    {
        projectId: '00000000-0000-4000-8000-000000000003',
        userId: 1,
        title: 'Конспект',
        lastModified: '2025-02-01T12:00:00Z',
        creationTime: '2024-01-01T12:00:00Z',
        isPublic: false,
        projectType: 'markdown',
        tags: [],
    },
];

async function openProjects(page: Page) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupProject();
    await routeSetup.setupListFilesRequest();
    await routeSetup.setupGetUserInfoRequest(true);
    await page.route('**/api/v4/public/project/all**', (route) =>
        route.fulfill({
            contentType: 'application/json',
            // сервер отдаёт старые первыми, страница переворачивает
            body: JSON.stringify({ projects: [...PROJECTS].reverse() }),
        })
    );
    await page.goto('/projects');
    await page.locator('tbody tr').first().waitFor();
}

// toHaveText ждёт, пока список перерисуется после ввода
const expectTitles = (page: Page, expected: string[]) =>
    expect(page.locator('tbody tr .project-title-text')).toHaveText(expected);

test('поиск находит проекты по словам из названия и меток', async ({
    page,
}) => {
    await openProjects(page);
    await expect(page.locator('tbody tr')).toHaveCount(3);

    await page.keyboard.press('/');
    await page.keyboard.type('лаб диплом');

    await expectTitles(page, ['Лабораторная 10']);
    await expect(page.locator('.projects-summary')).toContainText('1');

    await page.getByRole('button', { name: 'Reset filters' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(3);
});

const sidebar = (page: Page) => page.locator('.projects-sidebar');
const sidebarItem = (page: Page, name: string | RegExp) =>
    sidebar(page).locator('.projects-sidebar__button', { hasText: name });

test('метка в боковой панели и в строке фильтрует список', async ({ page }) => {
    await openProjects(page);
    await expect(sidebarItem(page, 'Физика')).toContainText('2');

    await sidebarItem(page, 'Физика').click();
    await expectTitles(page, ['Лабораторная 2', 'Лабораторная 10']);
    await expect(sidebarItem(page, 'Физика')).toHaveAttribute(
        'aria-pressed',
        'true'
    );

    // щелчок по метке в строке не открывает проект, а выбирает её
    await page
        .locator('tbody tr', { hasText: 'Лабораторная 10' })
        .getByRole('button', { name: /Диплом/ })
        .click();
    await expect(page).toHaveURL(/\/projects$/);
    await expectTitles(page, ['Лабораторная 10']);

    await sidebarItem(page, 'No tags').click();
    await expectTitles(page, ['Конспект']);

    await sidebarItem(page, 'All projects').click();
    await expect(page.locator('tbody tr')).toHaveCount(3);
});

test('новый тег из боковой панели ставится на выбранные проекты', async ({
    page,
}) => {
    await openProjects(page);
    const sent: Record<string, unknown> = {};
    await page.route('**/api/v4/public/project/*/tags', async (route) => {
        const id = route.request().url().split('/').at(-2)!;
        sent[id] = route.request().postDataJSON();
        await route.fulfill({
            contentType: 'application/json',
            body: route.request().postData()!,
        });
    });

    await sidebar(page).getByRole('button', { name: 'New tag' }).click();
    const modal = page.locator('.tag-edit-modal');
    await modal.getByRole('textbox').fill('Черновик');
    // без проектов тег не сохранить: он хранится в проектах
    await expect(modal.getByRole('button', { name: 'Save' })).toBeDisabled();
    await modal.getByRole('checkbox', { name: 'Конспект' }).check();
    await modal.getByRole('button', { name: 'Save' }).click();

    await expect(sidebarItem(page, 'Черновик')).toContainText('1');
    expect(Object.keys(sent)).toEqual([PROJECTS[2].projectId]);
    await expect(
        page
            .locator('tbody tr', { hasText: 'Конспект' })
            .locator('.project-tag')
    ).toHaveText(['Черновик']);
});

test('тег переименовывается и удаляется из его меню', async ({ page }) => {
    await openProjects(page);
    const calls: string[] = [];
    await page.route('**/api/v4/public/project/*/tags', async (route) => {
        calls.push(route.request().url().split('/').at(-2)!);
        await route.fulfill({
            contentType: 'application/json',
            body: route.request().postData()!,
        });
    });

    const physics = sidebar(page).locator('.projects-sidebar__item', {
        hasText: 'Физика',
    });
    await physics.hover();
    await physics.getByRole('button', { name: /Tag actions/ }).click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    const modal = page.locator('.tag-edit-modal');
    await modal.getByRole('textbox').fill('Физ');
    await modal.getByRole('button', { name: 'Save' }).click();

    await expect(sidebarItem(page, 'Физ')).toContainText('2');
    await expect(sidebarItem(page, 'Физика')).toHaveCount(0);
    expect(calls).toHaveLength(2);

    const renamed = sidebar(page).locator('.projects-sidebar__item', {
        hasText: 'Физ',
    });
    await renamed.hover();
    await renamed.getByRole('button', { name: /Tag actions/ }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Yes' }).click();

    await expect(sidebarItem(page, 'Физ')).toHaveCount(0);
    await expect(page.locator('tbody tr')).toHaveCount(3);
});

test('фильтр по типу и доступу', async ({ page }) => {
    await openProjects(page);

    await page
        .getByRole('group', { name: 'Type' })
        .getByText('Markdown')
        .click();
    await expectTitles(page, ['Конспект']);

    await page.getByRole('group', { name: 'Type' }).getByText('All').click();
    await sidebarItem(page, 'Public').click();
    await expectTitles(page, ['Лабораторная 10']);
    await sidebarItem(page, 'Private').click();
    await expectTitles(page, ['Лабораторная 2', 'Конспект']);
});

test('сортировка по колонке и её смена направления', async ({ page }) => {
    await openProjects(page);
    // по умолчанию сначала недавно изменённые
    await expectTitles(page, ['Лабораторная 2', 'Конспект', 'Лабораторная 10']);

    const nameHeader = page.locator('th').first().getByRole('button');
    await nameHeader.click();
    await expectTitles(page, ['Конспект', 'Лабораторная 2', 'Лабораторная 10']);
    await nameHeader.click();
    await expectTitles(page, ['Лабораторная 10', 'Лабораторная 2', 'Конспект']);
});

test('метки проекта меняются в окне и уходят одним запросом', async ({
    page,
}) => {
    await openProjects(page);
    const sent: unknown[] = [];
    await page.route('**/api/v4/public/project/*/tags', async (route) => {
        const body = route.request().postDataJSON();
        sent.push(body);
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify(body),
        });
    });

    const row = page.locator('tbody tr', { hasText: 'Лабораторная 10' });
    await row.hover();
    await row.getByRole('button', { name: 'Project actions' }).click();
    await page.getByRole('menuitem', { name: 'Tags…' }).click();

    const modal = page.locator('.tags-modal');
    await modal.getByRole('button', { name: /Delete Физика/ }).click();
    await modal.getByRole('textbox').fill('Черновик');
    await modal.getByRole('textbox').press('Enter');
    await modal.getByRole('button', { name: 'Save' }).click();

    await expect.poll(() => sent).toHaveLength(1);
    expect(sent[0]).toEqual({
        tags: [
            THESIS,
            { name: 'Черновик', color: expect.stringMatching(/^#/) },
        ],
    });
    await expect(row.locator('.project-tag')).toHaveText([
        'Диплом',
        'Черновик',
    ]);
});

test('меню проекта делает его публичным и копирует', async ({ page }) => {
    await openProjects(page);
    const visibility: string[] = [];
    let cloned = 0;
    await page.route('**/api/v4/public/project/*/visibility**', (route) => {
        visibility.push(new URL(route.request().url()).search);
        return route.fulfill({ contentType: 'application/json', body: '{}' });
    });
    await page.route('**/api/v4/public/project/*/clone', (route) => {
        cloned += 1;
        return route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ ...PROJECTS[0], program: {} }),
        });
    });

    const row = page.locator('tbody tr').first();
    await row.hover();
    await row.getByRole('button', { name: 'Project actions' }).click();
    await page.getByRole('menuitem', { name: 'Make public' }).click();
    await expect.poll(() => visibility).toEqual(['?public=true']);
    await expect(row.locator('.projects-access')).toHaveText('Public');

    await row.hover();
    await row.getByRole('button', { name: 'Project actions' }).click();
    await expect(
        page.getByRole('menuitem', { name: 'Copy link' })
    ).toBeVisible();
    await page.getByRole('menuitem', { name: 'Make a copy' }).click();
    await expect.poll(() => cloned).toBe(1);
    await expect(page).toHaveURL(/\/projects$/);
});

test('переименование из меню проекта', async ({ page }) => {
    await openProjects(page);
    let renamedTo = '';
    await page.route('**/api/v4/public/project/*/title**', (route) => {
        renamedTo = new URL(route.request().url()).searchParams.get('name')!;
        return route.fulfill({ contentType: 'application/json', body: '{}' });
    });

    const row = page.locator('tbody tr').first();
    await row.hover();
    await row.getByRole('button', { name: 'Project actions' }).click();
    await page.getByRole('menuitem', { name: 'Rename' }).click();

    const input = row.locator('input.input-base');
    await expect(input).toBeFocused();
    await input.fill('Лабораторная 3');
    await input.press('Enter');

    await expect.poll(() => renamedTo).toBe('Лабораторная 3');
    await expect(page).toHaveURL(/\/projects$/);
});

test('меню проекта работает с клавиатуры', async ({ page }) => {
    await openProjects(page);
    const button = page
        .locator('tbody tr')
        .first()
        .getByRole('button', { name: 'Project actions' });
    await button.focus();
    await page.keyboard.press('Enter');

    const items = page.getByRole('menuitem');
    await expect(items.first()).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(items.nth(1)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(button).toBeFocused();
});

test('щелчок по строке, которым закончили переименование, проект не открывает', async ({
    page,
}) => {
    await openProjects(page);
    let renamed = '';
    await page.route('**/api/v4/public/project/*/title**', (route) => {
        renamed = new URL(route.request().url()).searchParams.get('name')!;
        return route.fulfill({ contentType: 'application/json', body: '{}' });
    });

    const row = page.locator('tbody tr').first();
    await row.hover();
    await row.getByRole('button', { name: 'Project actions' }).click();
    await page.getByRole('menuitem', { name: 'Rename' }).click();
    await row.locator('input.input-base').fill('Лабораторная 3');
    await row.locator('.projects-col-type').click();

    await expect.poll(() => renamed).toBe('Лабораторная 3');
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/\/projects$/);

    // следующий щелчок открывает проект как обычно
    await row.locator('.projects-col-type').click();
    await expect(page).toHaveURL(/\/project\/[0-9a-f-]+$/);
});
