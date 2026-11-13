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

async function openProjects(page: Page, projects = PROJECTS) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupProject();
    await routeSetup.setupListFilesRequest();
    await routeSetup.setupGetUserInfoRequest(true);
    await page.route('**/api/v4/public/project/all**', (route) =>
        route.fulfill({
            contentType: 'application/json',
            // сервер отдаёт старые первыми, страница переворачивает
            body: JSON.stringify({ projects: [...projects].reverse() }),
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
    // «N из M» стоит в счётчике у заголовка, а список под фильтрами не сдвигается
    const list = page.locator('.projects-list-wrapper');
    const top = (await list.boundingBox())!.y;
    await expect(page.locator('.projects-header__count--filtered')).toHaveText(
        /1 of 3/
    );
    expect((await list.boundingBox())!.y).toBe(top);

    await page.getByRole('button', { name: /Reset filters/ }).click();
    await expect(page.locator('tbody tr')).toHaveCount(3);
    expect((await list.boundingBox())!.y).toBe(top);
});

const sidebar = (page: Page) => page.locator('.projects-sidebar');
// имя целиком: «Физ» не должно находить «Физика»
const exactly = (name: string) =>
    new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
const sidebarLabel = (page: Page, name: string) =>
    page.locator('.projects-sidebar__label', { hasText: exactly(name) });
const sidebarItem = (page: Page, name: string) =>
    sidebar(page).locator('.projects-sidebar__button', {
        has: sidebarLabel(page, name),
    });
const sidebarRow = (page: Page, name: string) =>
    sidebar(page).locator('.projects-sidebar__item', {
        has: sidebarLabel(page, name),
    });

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
    await expect.poll(() => Object.keys(sent)).toEqual([PROJECTS[2].projectId]);
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

    // выбранная метка остаётся выбранной и после переименования
    await sidebarItem(page, 'Физика').click();
    const physics = sidebarRow(page, 'Физика');
    await physics.hover();
    await physics.getByRole('button', { name: /Tag actions/ }).click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    const modal = page.locator('.tag-edit-modal');
    await modal.getByRole('textbox').fill('Физ');
    await modal.getByRole('button', { name: 'Save' }).click();

    await expect(sidebarItem(page, 'Физ')).toContainText('2');
    await expect(sidebarItem(page, 'Физика')).toHaveCount(0);
    await expect(sidebarItem(page, 'Физ')).toHaveAttribute(
        'aria-pressed',
        'true'
    );
    await expect(page.locator('tbody tr')).toHaveCount(2);
    await expect.poll(() => calls).toHaveLength(2);

    const renamed = sidebarRow(page, 'Физ');
    await renamed.hover();
    await renamed.getByRole('button', { name: /Tag actions/ }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Yes' }).click();

    // удалённая метка больше не выбрана: видны все проекты
    await expect(sidebarItem(page, 'Физ')).toHaveCount(0);
    await expect(page.locator('tbody tr')).toHaveCount(3);
    await expect(sidebarItem(page, 'All projects')).toHaveAttribute(
        'aria-pressed',
        'true'
    );
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

test('после переименования, законченного щелчком по метке, Enter открывает проект', async ({
    page,
}) => {
    await openProjects(page);
    await page.route('**/api/v4/public/project/*/title**', (route) =>
        route.fulfill({ contentType: 'application/json', body: '{}' })
    );

    // по номеру: в поле ввода названия нет текста, по которому искать строку
    const row = page.locator('tbody tr').nth(2);
    await expect(row).toContainText('Лабораторная 10');
    await row.hover();
    await row.getByRole('button', { name: 'Project actions' }).click();
    await page.getByRole('menuitem', { name: 'Rename' }).click();
    await row.locator('input.input-base').fill('Лабораторная 11');
    // щелчок по метке в строке выше завершает переименование и выбирает
    // метку; эта строка от конца переименования не сдвигается
    await page
        .locator('tbody tr')
        .first()
        .getByRole('button', { name: /Физика/ })
        .click();
    await expectTitles(page, ['Лабораторная 2', 'Лабораторная 11']);

    await page
        .locator('tbody tr', { hasText: 'Лабораторная 11' })
        .locator('a.project-title-link')
        .focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/project\/[0-9a-f-]+$/);
});

test('«Назад» из открытого проекта сразу возвращает к списку', async ({
    page,
}) => {
    // мок открытия проекта отдаёт проект с этим id: открываем в списке его же
    const opened = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';
    await openProjects(page, [{ ...PROJECTS[0], projectId: opened }]);
    await page
        .locator('tbody tr')
        .first()
        .locator('.projects-col-type')
        .click();
    await expect(page).toHaveURL(new RegExp(`/project/${opened}$`));
    await page.waitForTimeout(500);

    await page.goBack();
    await expect(page).toHaveURL(/\/projects$/);
});

test('метка, снятая со всех проектов, не выбирается сама, когда появится снова', async ({
    page,
}) => {
    await openProjects(page);
    await page.route('**/api/v4/public/project/*/tags', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: route.request().postData()!,
        })
    );
    const editTags = async (title: string) => {
        const row = page.locator('tbody tr', { hasText: title });
        await row.hover();
        await row.getByRole('button', { name: 'Project actions' }).click();
        await page.getByRole('menuitem', { name: 'Tags…' }).click();
        return page.locator('.tags-modal');
    };

    await sidebarItem(page, 'Диплом').click();
    await expectTitles(page, ['Лабораторная 10']);

    let modal = await editTags('Лабораторная 10');
    await modal.getByRole('button', { name: /Delete Диплом/ }).click();
    await modal.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(3);

    modal = await editTags('Конспект');
    await modal.getByRole('textbox').fill('Диплом');
    await modal.getByRole('button', { name: 'Save' }).click();

    await expect(sidebarItem(page, 'Диплом')).toContainText('1');
    await expect(page.locator('tbody tr')).toHaveCount(3);
    await expect(sidebarItem(page, 'Диплом')).toHaveAttribute(
        'aria-pressed',
        'false'
    );
});

test('неудачное переименование метки оставляет её выбранной', async ({
    page,
}) => {
    await openProjects(page);
    await page.route('**/api/v4/public/project/*/tags', (route) =>
        route.fulfill({ status: 500, body: '{}' })
    );

    await sidebarItem(page, 'Физика').click();
    const physics = sidebarRow(page, 'Физика');
    await physics.hover();
    await physics.getByRole('button', { name: /Tag actions/ }).click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    const modal = page.locator('.tag-edit-modal');
    await modal.getByRole('textbox').fill('Химия');
    await modal.getByRole('button', { name: 'Save' }).click();

    await expect(sidebarItem(page, 'Физика')).toHaveAttribute(
        'aria-pressed',
        'true'
    );
    await expectTitles(page, ['Лабораторная 2', 'Лабораторная 10']);
});

test('поле переименования не меняет высоту строки и не шире ячейки', async ({
    page,
}) => {
    await openProjects(page);
    const row = page.locator('tbody tr').first();
    const before = (await row.boundingBox())!;
    await row.hover();
    await row.getByRole('button', { name: 'Project actions' }).click();
    await page.getByRole('menuitem', { name: 'Rename' }).click();

    const input = row.locator('input.input-base');
    await expect(input).toBeFocused();
    const cell = (await row.locator('td').first().boundingBox())!;
    const field = (await input.boundingBox())!;
    expect(field.x + field.width).toBeLessThanOrEqual(cell.x + cell.width);
    expect(Math.abs((await row.boundingBox())!.height - before.height)).toBe(0);
});

const manyProjects = (count: number, tagsEach = 0) =>
    Array.from({ length: count }, (_, i) => ({
        ...PROJECTS[0],
        projectId: `00000000-0000-4000-8000-${String(100 + i).padStart(12, '0')}`,
        title: `Проект ${i + 1}`,
        tags: Array.from({ length: tagsEach }, (_, j) => ({
            name: `Метка ${i * tagsEach + j + 1}`,
            color: '#4469e0',
        })),
    }));

const inRussian = (page: Page) =>
    page.addInitScript(() =>
        window.localStorage.setItem('labkeeper_lang', 'ru')
    );

test('Enter в поиске окна тега только ищет и тег не сохраняет', async ({
    page,
}) => {
    await openProjects(page, manyProjects(10));
    let saves = 0;
    await page.route('**/api/v4/public/project/*/tags', (route) => {
        saves++;
        return route.fulfill({ contentType: 'application/json', body: '{}' });
    });

    await sidebar(page).getByRole('button', { name: 'New tag' }).click();
    const modal = page.locator('.tag-edit-modal');
    await modal.getByRole('textbox').first().fill('Черновик');
    await modal
        .getByRole('checkbox', { name: 'Проект 1', exact: true })
        .check();
    const search = modal.getByRole('searchbox');
    await search.fill('Проект 2');
    await search.press('Enter');

    await expect(modal).toBeVisible();
    await expect(
        modal.getByRole('checkbox', { name: 'Проект 2', exact: true })
    ).toBeVisible();
    expect(saves).toBe(0);
});

test('Enter в переименовании отправляет имя один раз, Escape отменяет', async ({
    page,
}) => {
    await openProjects(page);
    const sent: string[] = [];
    await page.route('**/api/v4/public/project/*/title**', (route) => {
        sent.push(new URL(route.request().url()).searchParams.get('name')!);
        return route.fulfill({ contentType: 'application/json', body: '{}' });
    });
    const row = page.locator('tbody tr').first();
    const rename = async () => {
        await row.hover();
        await row.getByRole('button', { name: 'Project actions' }).click();
        await page.getByRole('menuitem', { name: 'Rename' }).click();
        const input = row.locator('input.input-base');
        await expect(input).toBeFocused();
        return input;
    };

    const first = await rename();
    await first.fill('Отменённое имя');
    await first.press('Escape');
    await expect(row.locator('.project-title-text')).toHaveText(
        'Лабораторная 2'
    );

    const second = await rename();
    await second.fill('Лабораторная 3');
    await second.press('Enter');
    await expect.poll(() => sent).toEqual(['Лабораторная 3']);
    // запоздалый blur второй запрос не шлёт
    await page.waitForTimeout(300);
    expect(sent).toEqual(['Лабораторная 3']);
});

test('когда под фильтр ничего не подошло, счётчик пишет 0 из N и сбрасывает', async ({
    page,
}) => {
    await openProjects(page);
    await page.keyboard.press('/');
    await page.keyboard.type('такого нет');

    const count = page.locator('.projects-header__count--filtered');
    await expect(count).toHaveText(/0 of 3/);
    await count.click();
    await expect(page.locator('tbody tr')).toHaveCount(3);
});

test('на телефоне по-русски сброс фильтра в шапке не закрыт кнопкой', async ({
    page,
}) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await inRussian(page);
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupProject();
    await routeSetup.setupListFilesRequest();
    await routeSetup.setupGetUserInfoRequest(true);
    const projects = manyProjects(36);
    await page.route('**/api/v4/public/project/all**', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ projects }),
        })
    );
    await page.goto('/projects');
    const search = page.getByRole('searchbox').first();
    await search.fill('Проект 1');

    const count = page.locator('.projects-header__count--filtered');
    await expect(count).toHaveText(/из 36/);
    const pill = (await count.boundingBox())!;
    const add = (await page.locator('.projects-header__add').boundingBox())!;
    expect(pill.x + pill.width).toBeLessThanOrEqual(add.x);
    expect(await count.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
        true
    );
});

test('по-русски стрелка сортировки по дате видна целиком', async ({ page }) => {
    await inRussian(page);
    await openProjects(page);
    // колонка «Последнее изменение»; дата создания на этой ширине скрыта
    const header = page.locator('th.projects-col-date', {
        hasText: 'Последнее изменение',
    });
    const arrow = header.locator('.sort-arrow');
    await expect(arrow).toBeVisible();
    const cell = (await header.boundingBox())!;
    const box = (await arrow.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(cell.x + cell.width);
});

test('с множеством меток кнопка «New tag» в панели не сжимается', async ({
    page,
}) => {
    await page.setViewportSize({ width: 1440, height: 700 });
    await openProjects(page, manyProjects(12, 3));
    const newTag = sidebar(page).getByRole('button', { name: 'New tag' });
    expect(
        await newTag.evaluate((el) => el.scrollHeight <= el.clientHeight)
    ).toBe(true);
});

test('название не сжимается в ноль на узком окне компьютера', async ({
    page,
}) => {
    await page.setViewportSize({ width: 800, height: 900 });
    await openProjects(page);
    const title = page.locator('tbody tr .project-title-text').first();
    expect((await title.boundingBox())!.width).toBeGreaterThan(80);
    expect(
        await page.evaluate(
            () =>
                document.documentElement.scrollWidth <=
                document.documentElement.clientWidth
        )
    ).toBe(true);
});

test('при наведении на «All projects» число проектов не пропадает', async ({
    page,
}) => {
    await openProjects(page);
    const all = sidebar(page).locator('.projects-sidebar__item').first();
    await all.hover();
    await expect(all.locator('.projects-sidebar__count')).toBeVisible();
    // у метки число по-прежнему меняется на «⋯»
    await sidebarRow(page, 'Физика').hover();
    await expect(
        sidebarRow(page, 'Физика').locator('.projects-sidebar__count')
    ).toBeHidden();
});

test('окно меток на низком телефоне прокручивается, а не сжимается', async ({
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 640 });
    const many = Array.from({ length: 14 }, (_, i) => ({
        name: `Метка ${i + 1}`,
        color: '#4469e0',
    }));
    // и метки других проектов: окно предлагает их ниже
    const others = many.map((tag) => ({
        ...tag,
        name: `Другая ${tag.name}`,
    }));
    await openProjectsOnPhone(page, [
        { ...PROJECTS[0], tags: many },
        { ...PROJECTS[1], tags: others },
    ]);
    await page.getByRole('button', { name: 'Project actions' }).first().click();
    await page.getByRole('menuitem', { name: /Tags/ }).click();

    const modal = page.locator('.tags-modal');
    await expect(modal).toBeVisible();
    // ни одна часть окна не ужата меньше своего содержимого
    expect(
        await modal.evaluate((el) =>
            [...el.children].every(
                (child) =>
                    child.getBoundingClientRect().height + 1 >=
                    child.scrollHeight
            )
        )
    ).toBe(true);
});

test('на телефоне по-русски заголовок с фильтром не обрезается', async ({
    page,
}) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await inRussian(page);
    await openProjectsOnPhone(page, manyProjects(36));
    await page.getByRole('searchbox').first().fill('Проект 1');
    await expect(
        page.locator('.projects-header__count--filtered')
    ).toBeVisible();

    const title = page.locator('.projects-header .typography.h1');
    expect(await title.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
        true
    );
    // от «Добавить» остался плюс, но имя у кнопки есть
    await expect(
        page.getByRole('button', { name: 'Добавить' }).first()
    ).toBeVisible();
});

async function openProjectsOnPhone(page: Page, projects: unknown[]) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupProject();
    await routeSetup.setupListFilesRequest();
    await routeSetup.setupGetUserInfoRequest(true);
    await page.route('**/api/v4/public/project/all**', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ projects }),
        })
    );
    await page.goto('/projects');
}

test('на сенсорном планшете после касания метки её число видно', async ({
    browser,
}) => {
    const context = await browser.newContext({
        viewport: { width: 1024, height: 768 },
        hasTouch: true,
        isMobile: true,
    });
    try {
        const page = await context.newPage();
        await openProjects(page);
        expect(
            await page.evaluate(() => matchMedia('(hover: none)').matches)
        ).toBe(true);

        await sidebarItem(page, 'Физика').tap();
        await expect(
            sidebarRow(page, 'Физика').locator('.projects-sidebar__count')
        ).toBeVisible();
    } finally {
        await context.close();
    }
});

test('подтверждение удаления проекта с длинным названием не шире окна', async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    const long = 'Оченьдлинноеназваниебезпробелов'.repeat(4);
    await openProjects(page, [{ ...PROJECTS[0], title: long }]);
    const row = page.locator('tbody tr').first();
    await row.hover();
    await row.getByRole('button', { name: 'Project actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();

    const modal = page.locator('.delete-project-modal');
    await expect(modal).toBeVisible();
    expect((await modal.boundingBox())!.width).toBeLessThanOrEqual(520);
    expect(await modal.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
        true
    );
});

test('кнопки окна меток видны и на невысоком окне', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 600 });
    const many = Array.from({ length: 14 }, (_, i) => ({
        name: `Метка ${i + 1}`,
        color: '#4469e0',
    }));
    const others = many.map((tag) => ({
        ...tag,
        name: `Другая ${tag.name}`,
    }));
    await openProjects(page, [
        { ...PROJECTS[0], tags: many },
        { ...PROJECTS[1], tags: others },
    ]);
    const row = page.locator('tbody tr').first();
    await row.hover();
    await row.getByRole('button', { name: 'Project actions' }).click();
    await page.getByRole('menuitem', { name: 'Tags…' }).click();

    const save = page
        .locator('.tags-modal__buttons')
        .getByRole('button')
        .last();
    await expect(save).toBeInViewport({ ratio: 1 });
});

test('на телефоне лёжа подтверждение удаления стоит по центру', async ({
    page,
}) => {
    await page.setViewportSize({ width: 740, height: 360 });
    await openProjectsOnPhone(page, PROJECTS);
    await page.getByRole('button', { name: 'Project actions' }).first().click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();

    const modal = (await page.locator('.delete-project-modal').boundingBox())!;
    const card = (await page.locator('.modal-contaier').boundingBox())!;
    const left = modal.x - card.x;
    const right = card.x + card.width - (modal.x + modal.width);
    expect(Math.abs(left - right)).toBeLessThanOrEqual(2);
});

test('прилипшие кнопки окна меток стоят с отступом от края и не прячут фокус', async ({
    page,
}) => {
    await page.setViewportSize({ width: 1024, height: 600 });
    const many = Array.from({ length: 14 }, (_, i) => ({
        name: `Метка ${i + 1}`,
        color: '#4469e0',
    }));
    const others = many.map((tag) => ({
        ...tag,
        name: `Другая ${tag.name}`,
    }));
    await openProjects(page, [
        { ...PROJECTS[0], tags: many },
        { ...PROJECTS[1], tags: others },
    ]);
    const row = page.locator('tbody tr').first();
    await row.hover();
    await row.getByRole('button', { name: 'Project actions' }).click();
    await page.getByRole('menuitem', { name: 'Tags…' }).click();

    const modal = page.locator('.tags-modal');
    const bar = page.locator('.tags-modal__buttons');
    const save = bar.getByRole('button').last();
    // окно прокручивается, а кнопки прилипли с прежним нижним отступом
    expect(
        await modal.evaluate((el) => el.scrollHeight > el.clientHeight)
    ).toBe(true);
    const modalBox = (await modal.boundingBox())!;
    const saveBox = (await save.boundingBox())!;
    expect(modalBox.y + modalBox.height - (saveBox.y + saveBox.height)).toBe(
        28
    );

    // подсказка в самом низу, получив фокус, не уходит под кнопки
    const last = page.locator('.tags-modal__suggestions-list button').last();
    // Tab прокручивает к фокусу до ближайшего края, как scrollIntoView
    await modal.evaluate((el) => el.scrollTo(0, 0));
    await last.evaluate((el) => el.scrollIntoView({ block: 'nearest' }));
    const barBox = (await bar.boundingBox())!;
    const lastBox = (await last.boundingBox())!;
    expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(barBox.y);
});
