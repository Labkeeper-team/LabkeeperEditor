import { expect, test, type Page, type Request } from '@playwright/test';
import { readFileSync } from 'fs';
import { RouteSetup } from './mock.routeSetUp.tsx';

/** GH-217: новый проект создаётся на своей странице, пустым или из шаблона */

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

// прозрачная картинка 1×1: превью шаблонов живут на сайте, а не в редакторе
const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64'
);

// настоящий PDF из соседнего опыта: окно результата должно его нарисовать
const PDF = readFileSync(
    new URL('./fixtures/pdf-links-selection.pdf', import.meta.url)
);

const TEMPLATES = [
    {
        slug: 'altacv',
        projectId: '11111111-1111-4111-8111-111111111111',
        title: 'Резюме AltaCV',
        description: 'Резюме в две колонки на LaTeX',
        categories: ['latex', 'cv'],
        path: '/templates/altacv',
        previewImage: '/assets/img/templates/altacv.png',
    },
    {
        slug: 'radiatsionnyi-fon',
        projectId: '22222222-2222-4222-8222-222222222222',
        title: 'Радиационный фон',
        description: 'Лабораторная работа с расчётом погрешностей',
        categories: ['markdown', 'labs'],
        path: '/templates/radiatsionnyi-fon',
        previewImage: '/assets/img/templates/radiatsionnyi-fon.png',
    },
    {
        slug: 'mdpi',
        projectId: '33333333-3333-4333-8333-333333333333',
        title: 'Статья MDPI',
        description: 'Шаблон статьи для журналов MDPI',
        categories: ['latex', 'mdpi'],
        path: '/templates/mdpi',
    },
];

const createdProject = (projectType: string) => ({
    projectId: uuid,
    userId: 1,
    title: 'Default Project',
    lastModified: new Date().toISOString(),
    isPublic: false,
    program: { segments: [], parameters: { roundStrategy: 'noRound' } },
    projectType,
});

type Calls = {
    create: Request[];
    clone: Request[];
    title: Request[];
};

async function openNewProject(
    page: Page,
    options: {
        authenticated?: boolean;
        templatesStatus?: number;
        /** Ответ user-info придёт, только когда исполнится обещание */
        holdUserInfo?: Promise<void>;
    } = {}
): Promise<Calls> {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupProject();
    await routeSetup.setupListFilesRequest();
    await routeSetup.setupGetUserInfoRequest(options.authenticated ?? true);
    await routeSetup.setupGetAllProjectsRequest();
    const { holdUserInfo } = options;
    if (holdUserInfo) {
        await page.route('**/api/v4/public/user-info**', async (route) => {
            await holdUserInfo;
            await route.fallback();
        });
    }

    const calls: Calls = { create: [], clone: [], title: [] };
    await page.route('**/api/v4/public/templates**', (route) =>
        route.fulfill({
            status: options.templatesStatus ?? 200,
            contentType: 'application/json',
            body: JSON.stringify({ templates: TEMPLATES }),
        })
    );
    await page.route('**/assets/img/templates/**', (route) =>
        route.fulfill({ contentType: 'image/png', body: PNG })
    );
    await page.route('**/api/v4/public/project/create**', (route) => {
        calls.create.push(route.request());
        if (options.authenticated === false) {
            return route.fulfill({ status: 401, body: '' });
        }
        const type = new URL(route.request().url()).searchParams.get('type');
        return route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify(createdProject(type ?? 'latex')),
        });
    });
    await page.route('**/api/v4/public/project/*/clone', (route) => {
        calls.clone.push(route.request());
        return route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
                ...createdProject('markdown'),
                title: 'Радиационный фон',
            }),
        });
    });
    await page.route(`**/api/v4/public/project/${uuid}/title**`, (route) => {
        calls.title.push(route.request());
        return route.fulfill({ status: 200, body: '' });
    });

    await page.goto('/projects/new');
    await expect(page.locator('.new-project__title')).toHaveText('New project');
    return calls;
}

const card = (page: Page, slug: string) =>
    page.locator(`.new-project__card[data-template="${slug}"]`);

const typeButton = (page: Page, name: string) =>
    page.locator('.new-project__type', {
        has: page.locator('.new-project__type-name', {
            hasText: new RegExp(`^${name}$`),
        }),
    });

test.use({ viewport: { width: 1360, height: 900 } });

test('кнопка в списке проектов ведёт на страницу нового проекта', async ({
    page,
}) => {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupProject();
    await routeSetup.setupListFilesRequest();
    await routeSetup.setupGetUserInfoRequest(true);
    await routeSetup.setupGetAllProjectsRequest();
    await page.route('**/api/v4/public/templates**', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ templates: TEMPLATES }),
        })
    );
    await page.goto('/projects');

    await page.getByRole('button', { name: 'Add', exact: true }).click();

    await expect(page).toHaveURL(/\/projects\/new$/);
    await expect(page.locator('.modal')).toHaveCount(0);
    await expect(card(page, 'altacv')).toBeVisible();
});

test('пустой проект создаётся с выбранным типом и введённым именем', async ({
    page,
}) => {
    const calls = await openNewProject(page);

    await expect(typeButton(page, 'LaTeX')).toHaveAttribute(
        'aria-pressed',
        'true'
    );
    await expect(typeButton(page, 'Markdown')).toContainText(
        'render right in the browser'
    );
    await typeButton(page, 'Markdown').click();
    await page.getByRole('textbox').fill('Лаба #3 & выводы');
    await page.getByRole('button', { name: 'Create project' }).click();

    await expect(page).toHaveURL(`/project/${uuid}`);
    expect(calls.clone).toHaveLength(0);
    expect(calls.create).toHaveLength(1);
    const url = new URL(calls.create[0].url());
    expect(url.searchParams.get('name')).toBe('Лаба #3 & выводы');
    expect(url.searchParams.get('type')).toBe('markdown');
});

test('проект из шаблона клонируется, переименовывается и открывается в агентском режиме', async ({
    page,
}) => {
    const calls = await openNewProject(page);

    await card(page, 'radiatsionnyi-fon')
        .locator('.new-project__card-select')
        .click();

    // имя подставилось из шаблона, тип задан шаблоном и не меняется
    await expect(page.getByRole('textbox')).toHaveValue('Радиационный фон');
    await expect(typeButton(page, 'Markdown')).toHaveAttribute(
        'aria-pressed',
        'true'
    );
    await expect(typeButton(page, 'LaTeX')).toBeDisabled();
    await expect(page.locator('.new-project__note')).toBeVisible();
    // картинка первой страницы видна на карточке
    await expect
        .poll(() =>
            card(page, 'radiatsionnyi-fon')
                .locator('img')
                .evaluate((img: HTMLImageElement) => img.naturalWidth)
        )
        .toBeGreaterThan(0);
    await expect(
        card(page, 'radiatsionnyi-fon').getByRole('link')
    ).toHaveAttribute('href', '/templates/radiatsionnyi-fon');

    await page.getByRole('textbox').fill('Моя лабораторная');
    await page.getByLabel('Open in agent mode').check();
    await page.getByRole('button', { name: 'Create project' }).click();

    await expect(page).toHaveURL(`/project/${uuid}/agent`);
    expect(calls.create).toHaveLength(0);
    expect(
        calls.clone.map((request) => new URL(request.url()).pathname)
    ).toEqual([
        '/api/v4/public/project/22222222-2222-4222-8222-222222222222/clone',
    ]);
    expect(new URL(calls.title[0].url()).searchParams.get('name')).toBe(
        'Моя лабораторная'
    );
});

test('выбор пустого проекта после шаблона возвращает тип и убирает имя шаблона', async ({
    page,
}) => {
    await openNewProject(page);

    await card(page, 'altacv').locator('.new-project__card-select').click();
    await expect(page.getByRole('textbox')).toHaveValue('Резюме AltaCV');

    await page
        .locator('.new-project__card', { hasText: 'Empty project' })
        .locator('.new-project__card-select')
        .click();

    await expect(page.getByRole('textbox')).toHaveValue('');
    await expect(typeButton(page, 'Markdown')).toBeEnabled();
    await expect(page.locator('.new-project__note')).toBeHidden();
});

test('фильтр показывает только темы каталога, журналы остаются среди всех', async ({
    page,
}) => {
    await openNewProject(page);

    const filters = page.locator('.new-project__filter');
    await expect(filters).toHaveText([
        'All templates',
        'Lab reports',
        'Resume / CV',
    ]);

    await filters.filter({ hasText: 'Resume / CV' }).click();
    await expect(page.locator('.new-project__card[data-template]')).toHaveCount(
        1
    );
    await expect(card(page, 'altacv')).toBeVisible();

    await filters.filter({ hasText: 'All templates' }).click();
    await expect(page.locator('.new-project__card[data-template]')).toHaveCount(
        3
    );
});

/** Где элемент внутри страницы, без учёта прокрутки: клик сам докручивает до карточки */
const offsetInPage = (page: Page, selector: string) =>
    page.evaluate((target) => {
        const content = document.querySelector('.new-project__content')!;
        return Math.round(
            document.querySelector(target)!.getBoundingClientRect().top -
                content.getBoundingClientRect().top
        );
    }, selector);

// GH-232: под кнопками типа появлялась подсказка и сдвигала карточки под курсором
for (const viewport of [
    { width: 1360, height: 900 },
    { width: 390, height: 844 },
]) {
    test(`выбор шаблона не сдвигает карточки на ${viewport.width}px`, async ({
        page,
    }) => {
        await page.setViewportSize(viewport);
        await openNewProject(page);
        const cardSelector =
            '.new-project__card[data-template="radiatsionnyi-fon"]';
        const before = await offsetInPage(page, cardSelector);
        const filtersBefore = await offsetInPage(page, '.new-project__filters');

        await card(page, 'radiatsionnyi-fon')
            .locator('.new-project__card-select')
            .click();

        await expect(page.locator('.new-project__note')).toBeVisible();
        await expect(page.getByRole('textbox')).toHaveValue('Радиационный фон');
        expect(await offsetInPage(page, cardSelector)).toBe(before);
        expect(await offsetInPage(page, '.new-project__filters')).toBe(
            filtersBefore
        );
    });
}

// GH-232: карточка работает как кнопка выбора, картинку и ссылку из неё не утащить
test('картинку и ссылку карточки нельзя утащить мышью', async ({ page }) => {
    await openNewProject(page);
    await page.evaluate(() => {
        const drags: string[] = [];
        (window as unknown as { drags: string[] }).drags = drags;
        document.addEventListener('dragstart', (event) =>
            drags.push((event.target as Element).tagName)
        );
    });
    const target = card(page, 'radiatsionnyi-fon');
    await expect
        .poll(() =>
            target
                .locator('img')
                .evaluate((img: HTMLImageElement) => img.naturalWidth)
        )
        .toBeGreaterThan(0);

    const box = (await target.locator('img').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 150, { steps: 8 });
    await page.mouse.up();

    expect(
        await page.evaluate(
            () => (window as unknown as { drags: string[] }).drags
        )
    ).toEqual([]);
    // перетаскивание ссылки Playwright не воспроизводит, поэтому смотрим на само свойство:
    // у ссылки оно по умолчанию включено
    expect(
        await target
            .getByRole('link')
            .evaluate((link: HTMLAnchorElement) => link.draggable)
    ).toBe(false);
});

test('без каталога можно создать пустой проект и повторить загрузку', async ({
    page,
}) => {
    await openNewProject(page, { templatesStatus: 404 });

    await expect(page.locator('.new-project__status')).toContainText(
        'Could not load templates'
    );
    await expect(
        page.locator('.new-project__card', { hasText: 'Empty project' })
    ).toBeVisible();

    await page.unroute('**/api/v4/public/templates**');
    await page.route('**/api/v4/public/templates**', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ templates: TEMPLATES }),
        })
    );
    await page.getByRole('button', { name: 'Try again' }).click();

    await expect(card(page, 'altacv')).toBeVisible();
    await expect(page.locator('.new-project__status')).toHaveCount(0);
});

// вход проверяет сервер: вошедший человек, нажавший до ответа user-info, получит проект
test('гостю создание предлагает войти', async ({ page }) => {
    const calls = await openNewProject(page, { authenticated: false });

    await page.getByRole('textbox').fill('Отчёт');
    await page.getByRole('button', { name: 'Create project' }).click();

    await expect(page.getByText('Authorization')).toBeVisible();
    expect(calls.create).toHaveLength(1);
    await expect(page).toHaveURL(/\/projects\/new$/);
    await expect(page.locator('.new-project__error')).toHaveCount(0);
});

test('нажатие до ответа user-info всё равно создаёт проект', async ({
    page,
}) => {
    let releaseUser: () => void = () => {};
    const userHeld = new Promise<void>((resolve) => {
        releaseUser = resolve;
    });
    const calls = await openNewProject(page, { holdUserInfo: userHeld });

    await page.getByRole('textbox').fill('Отчёт');
    await page.getByRole('button', { name: 'Create project' }).click();

    await expect(page).toHaveURL(`/project/${uuid}`);
    expect(calls.create).toHaveLength(1);
    await expect(page.getByText('Authorization')).toHaveCount(0);
    releaseUser();
});

test('на телефоне страница не шире экрана, а кнопка создания видна', async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openNewProject(page);

    await expect(card(page, 'altacv')).toBeVisible();
    const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(
        page.getByRole('button', { name: 'Create project' })
    ).toBeInViewport();
});

/**
 * GH-231: копия шаблона сразу собирается. В агентском режиме кнопки
 * «Выполнить» нет, а на телефоне открывалась пустая вкладка агента
 */
async function holdTemplateBuild(page: Page) {
    await page.route('**/api/v4/public/project/*/clone', (route) =>
        route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
                ...createdProject('latex'),
                title: 'Резюме AltaCV',
            }),
        })
    );
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    const builds: string[] = [];
    await page.route(
        `**/api/v4/public/project/${uuid}/compile/pdf**`,
        async (route) => {
            builds.push(route.request().url());
            await held;
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({ pdfUri: '/files/altacv.pdf' }),
            });
        }
    );
    await page.route('**/files/altacv.pdf', (route) =>
        route.fulfill({ contentType: 'application/pdf', body: PDF })
    );
    return { builds, release };
}

const pdfPage = (page: Page) =>
    page.locator('.project-pane--pdf [data-pdf-page="0"] canvas');

test('проект из шаблона сразу собирается и показывает PDF', async ({
    page,
}) => {
    await openNewProject(page);
    const build = await holdTemplateBuild(page);

    await card(page, 'altacv').locator('.new-project__card-select').click();
    await page.getByRole('button', { name: 'Create project' }).click();

    await expect(page).toHaveURL(`/project/${uuid}`);
    await expect.poll(() => build.builds.length).toBe(1);
    // пока документа нет, окно результата говорит, что он собирается
    await expect(
        page.locator('.project-pane--pdf').getByText('Building the document…')
    ).toBeVisible();

    build.release();

    await expect(pdfPage(page)).toBeVisible();
});

test('markdown-проект из шаблона тоже показывает, что собирается', async ({
    page,
}) => {
    await openNewProject(page);
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route(
        (url) => url.pathname === `/api/v4/public/project/${uuid}/compile`,
        async (route) => {
            await held;
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({ segments: [] }),
            });
        }
    );

    await card(page, 'radiatsionnyi-fon')
        .locator('.new-project__card-select')
        .click();
    await page.getByRole('button', { name: 'Create project' }).click();

    await expect(page).toHaveURL(`/project/${uuid}`);
    const result = page.locator('.project-pane--pdf .result-container');
    await expect(result.getByText('Building the document…')).toBeVisible();

    release();

    await expect(result.getByText('Building the document…')).toHaveCount(0);
});

test.describe('на телефоне', () => {
    // Firefox не умеет isMobile, ему хватает сенсорного экрана без мыши
    test.use({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: async ({ browserName }, provide) =>
            provide(browserName !== 'firefox'),
    });

    test('проект из шаблона в агентском режиме открывается на собираемом PDF', async ({
        page,
    }) => {
        await openNewProject(page);
        const build = await holdTemplateBuild(page);

        await card(page, 'altacv').locator('.new-project__card-select').tap();
        await page.getByLabel('Open in agent mode').check();
        await page.getByRole('button', { name: 'Create project' }).tap();

        await expect(page).toHaveURL(`/project/${uuid}/agent`);
        // не пустая вкладка агента, а PDF, который уже собирается
        await expect(
            page
                .locator('.project-pane--pdf')
                .getByText('Building the document…')
        ).toBeVisible();
        await expect(page.locator('.project-pane--agent')).toBeHidden();

        build.release();

        await expect(pdfPage(page)).toBeVisible();
    });
});
