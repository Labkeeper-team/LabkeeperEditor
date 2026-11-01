import { expect, test, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';
import { WikiLinks } from '../../viewModel/wiki.ts';

/** Шапка и подвал страницы токенов повторяют сайт: примеры на главной заменил каталог шаблонов */

async function openTokens(page: Page) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupApi();
    await routeSetup.setupGetUserInfoRequest(false);
    // страницы сайта живут не в редакторе: вместо них пустая страница
    await page.route(/\/(templates|blog|about)$/, (route) =>
        route.fulfill({ contentType: 'text/html', body: '<html></html>' })
    );
    await page.goto('/tokens');
    await expect(page.locator('.marketing-header')).toBeVisible();
}

const navLinks = (page: Page) =>
    page.locator('.marketing-header__nav-list .marketing-header__nav-link');

test('в шапке те же пункты, что на сайте, и токены отмечены', async ({
    page,
}) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openTokens(page);

    await expect(navLinks(page)).toHaveText([
        'Templates',
        'Tokens',
        'Knowledge Base',
        'About Us',
    ]);
    await expect(navLinks(page).filter({ hasText: 'Tokens' })).toHaveClass(
        /marketing-header__nav-link--active/
    );
});

test('шаблоны открываются на том же адресе, что и редактор', async ({
    page,
}) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openTokens(page);

    await navLinks(page).filter({ hasText: 'Templates' }).click();

    await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/templates$/);
});

test('на телефоне те же пункты в меню за кнопкой', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openTokens(page);

    await page.locator('.marketing-header__burger').click();

    await expect(navLinks(page)).toHaveText([
        'Templates',
        'Tokens',
        'Knowledge Base',
        'About Us',
    ]);
    await expect(navLinks(page).first()).toBeVisible();
});

test('подвал ведёт туда же, куда подвал сайта', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openTokens(page);

    const links = page.locator('.marketing-footer__nav a');
    await expect(links).toHaveText([
        'Advantages',
        'Features',
        'Tokens',
        'Documentation',
        'Knowledge Base',
        'About Us',
    ]);
    const hrefs = await links.evaluateAll((items) =>
        items.map((item) => item.getAttribute('href'))
    );
    expect(hrefs).toEqual([
        '/#features',
        '/#advantages',
        '/tokens',
        WikiLinks.home,
        '/blog',
        '/about',
    ]);
});
