import { expect, test, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

const CONSENT_TEXT =
    'I consent to the cross-border transfer of the data I enter to the DeepSeek service for processing my request and generating a response';

type Options = {
    authenticated?: boolean;
    consentOnServer?: boolean;
    consentLocally?: boolean;
    consentStatus?: number;
    /** Кадры от сервера: без завершающего поле ввода остаётся заблокированным */
    frames?: Record<string, unknown>[];
    /** Подпись вкладки агента, она зависит от языка интерфейса */
    agentLabel?: string;
};

async function openChat(page: Page, options: Options = {}) {
    const routeSetup = new RouteSetup(page);
    const authenticated = options.authenticated ?? true;
    await routeSetup.setupGetUserInfoRequest(
        authenticated,
        undefined,
        undefined,
        0,
        authenticated,
        options.consentOnServer ?? false
    );
    if (options.consentLocally) {
        await routeSetup.acceptCrossBorderConsentLocally();
    }
    await routeSetup.setupGetProjectRequest(200, 'default');
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    await routeSetup.setupAgentHistoryRequest([]);
    const consentCalls =
        await routeSetup.setupCrossBorderDataTransferPolicyRequest(
            options.consentStatus ?? 200
        );
    const sent = await routeSetup.setupAgentSocket(options.frames ?? []);

    await page.goto(`/project/${uuid}`);
    await page.waitForLoadState('domcontentloaded');
    await openAgentTab(page, options.agentLabel ?? 'AI agent');
    return { sent, consentCalls };
}

/** На узком экране колонки переключает выпадающий список, а не вкладки */
async function openAgentTab(page: Page, agentLabel: string) {
    const switcher = page.locator('.mobile-view-switcher-bar__toggle');
    if (await switcher.isVisible()) {
        await switcher.click();
        await page.getByRole('option', { name: agentLabel }).click();
        return;
    }
    await page.getByRole('tab', { name: agentLabel }).click();
}

async function submitPrompt(page: Page, text = 'сделай таблицу') {
    await page.getByPlaceholder('Enter your promt').fill(text);
    await page.getByRole('button', { name: 'Send' }).click();
}

const modal = (page: Page) => page.locator('.cross-border-consent-modal');
const acceptButton = (page: Page) =>
    page.getByRole('button', { name: 'Continue' });

test('consent-modal-blocks-the-first-prompt', async ({ page }) => {
    const { sent } = await openChat(page);

    await submitPrompt(page);

    await expect(modal(page)).toBeVisible();
    expect(sent).toHaveLength(0);
    // текст остаётся на месте, иначе человек потеряет написанное
    await expect(page.getByPlaceholder('Enter your promt')).toHaveValue(
        'сделай таблицу'
    );
});

test('consent-modal-shows-the-text-and-the-document-link', async ({ page }) => {
    await openChat(page);
    await submitPrompt(page);

    await expect(modal(page)).toContainText(CONSENT_TEXT);
    const link = modal(page).getByRole('link', {
        name: 'cross-border transfer',
    });
    await expect(link).toHaveAttribute('href', 'https://labkeeper.io/sogl_ds');
    await expect(link).toHaveAttribute('target', '_blank');
});

test('consent-continue-is-disabled-until-the-box-is-checked', async ({
    page,
}) => {
    await openChat(page);
    await submitPrompt(page);

    await expect(acceptButton(page)).toBeDisabled();
    await modal(page).locator('input[type="checkbox"]').check();
    await expect(acceptButton(page)).toBeEnabled();
});

test('consent-accepted-sends-the-prompt-and-tells-the-server', async ({
    page,
}) => {
    const { sent, consentCalls } = await openChat(page);
    await submitPrompt(page);

    await modal(page).locator('input[type="checkbox"]').check();
    await acceptButton(page).click();

    await expect(modal(page)).toBeHidden();
    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0]).toMatchObject({ prompt: 'сделай таблицу' });
    expect(consentCalls).toEqual(['POST']);
});

test('consent-is-asked-once-per-browser', async ({ page }) => {
    const { sent } = await openChat(page, {
        frames: [
            { type: 'agentFinished', message: 'готово', stopReason: 'Done' },
        ],
    });
    await submitPrompt(page, 'первый');
    await modal(page).locator('input[type="checkbox"]').check();
    await acceptButton(page).click();
    await expect.poll(() => sent.length).toBe(1);

    await submitPrompt(page, 'второй');

    await expect(modal(page)).toBeHidden();
    await expect.poll(() => sent.length).toBe(2);
});

test('consent-dismissed-keeps-the-prompt-unsent', async ({ page }) => {
    const { sent } = await openChat(page);
    await submitPrompt(page);

    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(modal(page)).toBeHidden();
    expect(sent).toHaveLength(0);
    await expect(page.getByPlaceholder('Enter your promt')).toHaveValue(
        'сделай таблицу'
    );
});

test('consent-stored-on-the-server-is-not-asked-again', async ({ page }) => {
    const { sent } = await openChat(page, { consentOnServer: true });

    await submitPrompt(page);

    await expect.poll(() => sent.length).toBe(1);
    await expect(modal(page)).toBeHidden();
});

test('guest-consent-is-not-sent-to-the-server', async ({ page }) => {
    const { sent, consentCalls } = await openChat(page, {
        authenticated: false,
    });
    await submitPrompt(page);

    await modal(page).locator('input[type="checkbox"]').check();
    await acceptButton(page).click();

    await expect.poll(() => sent.length).toBe(1);
    // гостю записывать согласие некуда, ручка дёргается только после входа
    expect(consentCalls).toHaveLength(0);
});

test('consent-accepted-before-login-is-sent-after-login', async ({ page }) => {
    const { consentCalls } = await openChat(page, {
        consentLocally: true,
        consentOnServer: false,
    });

    // старт уже прошёл с локальной отметкой: согласие должно уехать само
    await expect.poll(() => consentCalls).toEqual(['POST']);
});

test.describe('по-русски', () => {
    test.use({ locale: 'ru-RU' });

    test('consent-modal-keeps-the-wording-from-the-spec', async ({ page }) => {
        await openChat(page, { agentLabel: 'Агент' });
        await page
            .getByPlaceholder('Опишите, что сделать с проектом')
            .fill('сделай таблицу');
        await page.getByRole('button', { name: 'Отправить' }).click();

        // формулировка согласована с заказчиком дословно, менять её нельзя
        await expect(modal(page)).toContainText(
            'Я даю согласие на трансграничную передачу вводимых мной данных в сервис DeepSeek для обработки запроса и генерации ответа'
        );
        await expect(
            modal(page).getByRole('link', {
                name: 'согласие на трансграничную передачу',
            })
        ).toHaveAttribute('href', 'https://labkeeper.io/sogl_ds');
    });
});

test.describe('на телефоне', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('consent-modal-fits-a-phone-screen', async ({ page }) => {
        await openChat(page);
        await submitPrompt(page);

        await expect(modal(page)).toBeVisible();
        const box = await modal(page).boundingBox();
        expect(box).not.toBeNull();
        expect(box!.width).toBeLessThanOrEqual(390);
        // кнопка видна без горизонтальной прокрутки
        await expect(acceptButton(page)).toBeInViewport();
        const overflow = await page.evaluate(
            () =>
                document.documentElement.scrollWidth -
                document.documentElement.clientWidth
        );
        expect(overflow).toBeLessThanOrEqual(0);
    });
});
