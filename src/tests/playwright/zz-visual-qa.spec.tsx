import { test, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';

const OUT =
    'C:/Users/timat/AppData/Local/Temp/claude/e60945a0b1d85577/24bc9600-c172-4142-870a-8ea3cee61917/scratchpad/visual-qa/';
const COLORS = [
    '#4469e0',
    '#1ca852',
    '#f5e663',
    '#ffffff',
    'red',
    'rgb(1,2,3)',
    '',
    '#e0e0e0',
    '#ff8800',
    'lightyellow',
];
const LONG =
    'Очень длинное название лабораторной работы по физике конденсированного состояния вещества номер сорок два с приложениями';
const LONGTAG = 'СуперДлинноеНазваниеМеткиБезПробеловКотороеНеПомещается';
const tag = (i: number) => ({
    name: i === 3 ? LONGTAG : `Метка ${i}`,
    color: COLORS[i % COLORS.length],
});
const uuid = (i: number) =>
    `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;

function make(n: number, opts: { long?: boolean; manyOn?: number } = {}) {
    return Array.from({ length: n }, (_, i) => ({
        projectId: uuid(i + 1),
        userId: 1,
        title: opts.long && i % 2 === 0 ? `${LONG} ${i}` : `Проект ${i}`,
        lastModified: new Date(
            Date.UTC(2025, 0, 1) + i * 86400000
        ).toISOString(),
        creationTime: '2024-01-01T12:00:00Z',
        isPublic: i % 3 === 0,
        projectType: i % 4 === 0 ? 'markdown' : 'latex',
        tags:
            i === (opts.manyOn ?? -1)
                ? Array.from({ length: 12 }, (_, k) => tag(k))
                : [tag(i % 25), tag((i * 7) % 25)].filter(
                      (t, k, a) => a.findIndex((x) => x.name === t.name) === k
                  ),
    }));
}

async function open(page: Page, projects: unknown[], w: number, h = 900) {
    await page.setViewportSize({ width: w, height: h });
    const rs = new RouteSetup(page);
    await rs.setupProject();
    await rs.setupListFilesRequest();
    await rs.setupGetUserInfoRequest(true);
    await page.route('**/api/v4/public/project/all**', (r) =>
        r.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ projects }),
        })
    );
    await page.route('**/api/v4/public/project/*/tags', (r) =>
        r.fulfill({
            contentType: 'application/json',
            body: r.request().postData()!,
        })
    );
    await page.goto('/projects');
    if (projects.length)
        await page.locator('.project-title-text').first().waitFor();
    await page.waitForTimeout(1000);
}
const shot = (page: Page, name: string) =>
    page.screenshot({ path: OUT + name + '.png' });
async function lang(page: Page, l: string) {
    const s = page.locator('.labkeeper_header__language');
    await s.locator('.select-header').click();
    await s.getByText(l).click();
    await page.waitForTimeout(600);
}

for (const [l, code] of [
    ['Русский', 'ru'],
    ['中文', 'zh'],
]) {
    test(`mobile ${code}`, async ({ page }) => {
        await open(page, make(25, { long: true, manyOn: 24 }), 1280);
        await lang(page, l);
        for (const w of [390, 320]) {
            await page.setViewportSize({ width: w, height: 800 });
            await page.waitForTimeout(700);
            await shot(page, `m${w}-${code}`);
        }
    });
}

test('mobile menus', async ({ page }) => {
    await open(page, make(25, { long: true, manyOn: 24 }), 390, 800);
    await shot(page, 'm390-many-top');
    const card = page.locator('.projects-card').nth(2);
    await card.getByRole('button', { name: 'Project actions' }).click();
    await page.waitForTimeout(300);
    await shot(page, 'm390-menu');
    await page.getByRole('menuitem', { name: 'Tags…' }).click();
    await page.waitForTimeout(400);
    await shot(page, 'm390-tagsmodal');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    // last card menu
    await page.locator('.projects-card').last().scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page
        .locator('.projects-card')
        .last()
        .getByRole('button', { name: 'Project actions' })
        .click();
    await page.waitForTimeout(300);
    await shot(page, 'm390-menu-last');
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 320, height: 640 });
    await page.waitForTimeout(500);
    await shot(page, 'm320-640');
    // tag strip scroll
    const strip = page.locator('.projects-tags-filter');
    const info = await strip.evaluate((e) => ({
        sh: e.scrollHeight,
        ch: e.clientHeight,
        ov: getComputedStyle(e).overflowY,
    }));
    console.log('STRIP', JSON.stringify(info));
});

test('desktop extra', async ({ page }) => {
    await open(page, make(25, { long: true, manyOn: 24 }), 1440);
    await shot(page, 'd1440-many');
    // hover long sidebar tag + hover long title
    await page
        .locator('.projects-sidebar__item', { hasText: 'СуперДлинное' })
        .hover();
    await shot(page, 'd-hover-longtag');
    // non-hex tag edit
    const item = page
        .locator('.projects-sidebar__item', { hasText: 'Метка 4' })
        .first();
    await item.hover();
    await item.getByRole('button', { name: /Tag actions/ }).click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    await page.waitForTimeout(400);
    await shot(page, 'd-edit-red');
    await page.keyboard.press('Escape');
    // click a tag filter -> active chip
    await page
        .locator('.projects-sidebar__button', { hasText: 'Метка 9' })
        .first()
        .click();
    await page.waitForTimeout(400);
    await shot(page, 'd-filter-lightyellow');
    await page
        .locator('.projects-sidebar__button', { hasText: 'Метка 13' })
        .first()
        .click();
    await page.waitForTimeout(400);
    await shot(page, 'd-filter-white');
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(500);
    await shot(page, 'd1024-filter');
});
