import { expect, Page, test } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp';
import { Program, Segment } from '../../model/domain';

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

const HIGHLIGHT = '.highlight-text-editor';
const CURRENT = '.highlight-text-editor--current';
const NO_MATCH = '.search-no-match';

function programOf(texts: string[]): Program {
    return {
        segments: texts.map(
            (text) =>
                ({
                    type: 'md',
                    text,
                    parameters: { visible: true },
                }) as Segment
        ),
        parameters: { roundStrategy: 'noRound' },
    };
}

/** Открывает проект с готовой программой, чтобы не собирать сегменты кликами */
async function openProjectWith(page: Page, texts: string[]) {
    const routeSetup = new RouteSetup(page);
    const program = programOf(texts);

    await routeSetup.setupGetUserInfoRequest();
    await routeSetup.setupGetDefaultProjectRequest(
        200,
        'default',
        undefined,
        program
    );
    await routeSetup.setupGetProjectRequest(200, 'default', program);
    await routeSetup.setupListFilesRequest();

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(`/project/${uuid}`);
    // на загруженном раннере первая отрисовка сегментов не укладывается в дефолтные 5 секунд
    await expect(page.locator('.segment-editor-container').first()).toBeVisible(
        { timeout: 20000 }
    );
}

function searchField(page: Page) {
    return page.getByRole('textbox', { name: /Enter text to search/i });
}

async function openSearch(page: Page) {
    await page.locator('div.action-button').last().click();
    await expect(searchField(page)).toBeVisible();
}

async function typeQuery(page: Page, query: string) {
    const field = searchField(page);
    await field.click();
    await field.fill(query);
}

/** Индекс сегмента, в котором сейчас подсвечено текущее совпадение */
async function currentSegmentIndex(page: Page): Promise<number> {
    return page
        .locator(CURRENT)
        .first()
        .evaluate((node) => {
            const host = node
                .closest('.segment-editor-container')
                ?.querySelector('[id^="ide-segment-"]');
            return Number.parseInt(
                (host?.id ?? 'ide-segment--1').replace('ide-segment-', ''),
                10
            );
        });
}

test('typing-does-not-highlight-until-enter', async ({ page }) => {
    await openProjectWith(page, ['foo bar foo', 'baz']);
    await openSearch(page);

    await typeQuery(page, 'foo');
    await expect(page.locator(HIGHLIGHT)).toHaveCount(0);

    await searchField(page).press('Enter');
    await expect(page.locator(HIGHLIGHT)).toHaveCount(2);
    await expect(page.locator(CURRENT)).toHaveCount(1);
});

test('enter-keeps-focus-in-search-field', async ({ page }) => {
    await openProjectWith(page, ['foo', 'foo']);
    await openSearch(page);

    await typeQuery(page, 'foo');
    await searchField(page).press('Enter');

    await expect(searchField(page)).toBeFocused();
});

test('repeated-enter-moves-to-next-match-and-wraps', async ({ page }) => {
    await openProjectWith(page, ['foo', 'foo', 'foo']);
    await openSearch(page);

    await typeQuery(page, 'foo');
    await searchField(page).press('Enter');
    expect(await currentSegmentIndex(page)).toBe(0);

    await searchField(page).press('Enter');
    expect(await currentSegmentIndex(page)).toBe(1);

    await searchField(page).press('Enter');
    expect(await currentSegmentIndex(page)).toBe(2);

    await searchField(page).press('Enter');
    expect(await currentSegmentIndex(page)).toBe(0);
});

test('first-enter-starts-from-visible-area', async ({ page }) => {
    const texts = Array.from({ length: 30 }, (_, index) =>
        index === 0 || index === 24 ? 'needle' : `plain ${index}`
    );
    await openProjectWith(page, texts);
    await openSearch(page);

    // уводим скролл ниже первого вхождения
    await page.locator('#ide-segment-22').scrollIntoViewIfNeeded();

    await typeQuery(page, 'needle');
    await searchField(page).press('Enter');

    expect(await currentSegmentIndex(page)).toBe(24);
});

test('changed-query-restarts-from-visible-area', async ({ page }) => {
    await openProjectWith(page, ['foo', 'foo', 'foo']);
    await openSearch(page);

    await typeQuery(page, 'foo');
    await searchField(page).press('Enter');
    await searchField(page).press('Enter');
    expect(await currentSegmentIndex(page)).toBe(1);

    // поменяли текст: следующий Enter снова идёт от начала видимой области
    await typeQuery(page, 'fo');
    await typeQuery(page, 'foo');
    await searchField(page).press('Enter');

    expect(await currentSegmentIndex(page)).toBe(0);
});

test('no-match-highlights-field-and-typing-clears-it', async ({ page }) => {
    await openProjectWith(page, ['foo']);
    await openSearch(page);

    await typeQuery(page, 'zzz');
    await searchField(page).press('Enter');
    await expect(page.locator(NO_MATCH)).toHaveCount(1);

    await typeQuery(page, 'zz');
    await expect(page.locator(NO_MATCH)).toHaveCount(0);
});

test('empty-enter-does-nothing', async ({ page }) => {
    await openProjectWith(page, ['foo']);
    await openSearch(page);

    await searchField(page).click();
    await searchField(page).press('Enter');

    await expect(page.locator(HIGHLIGHT)).toHaveCount(0);
    await expect(page.locator(NO_MATCH)).toHaveCount(0);
});

test('close-by-esc-and-cross-clears-highlight', async ({ page }) => {
    await openProjectWith(page, ['foo bar']);
    await openSearch(page);

    await typeQuery(page, 'foo');
    await searchField(page).press('Enter');
    await expect(page.locator(HIGHLIGHT)).toHaveCount(1);

    await page.keyboard.press('Escape');
    await expect(page.locator(HIGHLIGHT)).toHaveCount(0);

    await openSearch(page);
    await expect(searchField(page)).toHaveValue('');

    await typeQuery(page, 'foo');
    await searchField(page).press('Enter');
    await expect(page.locator(HIGHLIGHT)).toHaveCount(1);

    await page.locator('div.input-delete-icon').click();
    await expect(page.locator(HIGHLIGHT)).toHaveCount(0);
});

test('search-is-case-sensitive', async ({ page }) => {
    await openProjectWith(page, ['Foo foo']);
    await openSearch(page);

    await typeQuery(page, 'foo');
    await searchField(page).press('Enter');

    await expect(page.locator(HIGHLIGHT)).toHaveCount(1);
});

/** Прокрутка к совпадению не должна утаскивать за собой всю страницу */
test('enter-does-not-scroll-the-whole-page', async ({ page }) => {
    await openProjectWith(page, ['первый foo текст', 'второй foo текст']);
    await openSearch(page);
    await typeQuery(page, 'foo');

    for (let i = 0; i < 4; i++) {
        await searchField(page).press('Enter');
        await expect(page.locator(CURRENT)).toHaveCount(1);
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    }
});
