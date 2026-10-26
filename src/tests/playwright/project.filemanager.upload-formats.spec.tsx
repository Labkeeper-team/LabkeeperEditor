import { expect, test, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';

/**
 * Загрузка классов и пакетов LaTeX и прочих текстовых файлов (GH-209).
 * Проверяем весь путь до сервера: файл не отклоняется проверкой формата и
 * уходит с тем именем и расширением, с каким его выбрали, иначе компилятору
 * подключать будет нечего
 */

test.use({ viewport: { width: 1360, height: 900 } });

/** Имена, с которыми ушли запросы на загрузку */
function recordUploads(page: Page) {
    const names: string[] = [];
    page.on('request', (request) => {
        const url = new URL(request.url());
        if (url.pathname.endsWith('/file/upload')) {
            names.push(url.searchParams.get('name') ?? '');
        }
    });
    return names;
}

async function openFileManager(page: Page) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest(true);
    await routeSetup.setupGetDefaultProjectRequest();
    await routeSetup.setupGetProjectRequest();
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest(200, 'default');
    await routeSetup.setupListFilesRequest(200, 'default');
    // загрузку принимаем с любым именем: проверяем, с каким именно её позвали
    await page.route(
        (url) => url.pathname.endsWith('/file/upload'),
        async (route) => route.fulfill({ status: 200 })
    );
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('div.file-manager-button').click();
    await page.getByText('Add files').waitFor();
}

async function pickFile(
    page: Page,
    file: { name: string; mimeType: string; body: string }
) {
    const chooser = page.waitForEvent('filechooser');
    await page.getByText('Add files').click();
    await (
        await chooser
    ).setFiles({
        name: file.name,
        mimeType: file.mimeType,
        buffer: Buffer.from(file.body),
    });
}

const toasts = (page: Page) => page.locator('div.Toastify__toast');

// GH-209: текст принимается с любым расширением, а accept в диалоге отсеял бы
// всё, чего нет в списке: файл нельзя было бы даже выбрать
test('поле выбора файлов не ограничивает расширения', async ({ page }) => {
    await openFileManager(page);

    await expect(page.locator('input[type=file]').first()).not.toHaveAttribute(
        'accept'
    );
});

// GH-209: файлы, которых раньше не было в списке
for (const file of [
    {
        name: 'russian.ldf',
        mimeType: '',
        body: '\\ProvidesFile{russian.ldf}\n',
    },
    {
        name: 'figure.eps',
        mimeType: 'application/postscript',
        // у EPS бывает двоичный заголовок превью с нулевыми байтами
        body: '\u00c5\u00d0\u00d3\u00c6\u0000\u0000%!PS-Adobe-3.0 EPSF-3.0\n',
    },
]) {
    test(`${file.name} загружается без ошибки формата`, async ({ page }) => {
        const uploads = recordUploads(page);
        await openFileManager(page);

        await pickFile(page, file);

        await expect.poll(() => uploads).toEqual([file.name]);
        await expect(toasts(page)).toHaveCount(0);
    });
}

// У .cls и .sty браузер обычно не определяет MIME, поэтому решает расширение
for (const { name, mimeType } of [
    { name: 'altacv.cls', mimeType: '' },
    { name: 'altacv.cls', mimeType: 'application/octet-stream' },
    { name: 'mystyle.sty', mimeType: '' },
    { name: 'MyStyle.STY', mimeType: 'application/octet-stream' },
]) {
    test(`${name} с MIME "${mimeType}" загружается без ошибки формата`, async ({
        page,
    }) => {
        const uploads = recordUploads(page);
        await openFileManager(page);

        await pickFile(page, {
            name,
            mimeType,
            body: '\\ProvidesClass{altacv}\n',
        });

        // имя и расширение доезжают до сервера нетронутыми
        await expect.poll(() => uploads).toEqual([name]);
        await expect(toasts(page)).toHaveCount(0);
    });
}

test('двоичный файл неизвестного формата отклоняется и на сервер не уходит', async ({
    page,
}) => {
    const uploads = recordUploads(page);
    await openFileManager(page);

    await pickFile(page, {
        name: 'archive.zip',
        mimeType: 'application/zip',
        body: 'PK\u0003\u0004\u0014\u0000\u0000\u0000',
    });

    await expect(toasts(page)).toBeVisible();
    await expect(toasts(page)).toContainText('Media type is not supported');
    expect(uploads).toEqual([]);
});

// Лимит размера не трогали: файл больше пяти мегабайт по-прежнему отклоняется
test('слишком большой класс отклоняется по размеру', async ({ page }) => {
    const uploads = recordUploads(page);
    await openFileManager(page);

    await pickFile(page, {
        name: 'huge.cls',
        mimeType: '',
        body: 'x'.repeat(6 * 1048576),
    });

    await expect(toasts(page)).toBeVisible();
    expect(uploads).toEqual([]);
});

/** Перетаскивание в корень дерева, как это делает e2e: dragenter, dragover и drop */
async function dropFileToRoot(
    page: Page,
    file: { name: string; mimeType: string; body: string }
) {
    const dataTransfer = await page.evaluateHandle(
        ({ name, mimeType, body }) => {
            const transfer = new DataTransfer();
            transfer.items.add(new File([body], name, { type: mimeType }));
            return transfer;
        },
        file
    );
    const root = page.locator('.tree-root-zone');
    await root.dispatchEvent('dragenter', { dataTransfer });
    await expect
        .poll(async () => {
            await root.dispatchEvent('dragover', { dataTransfer });
            return page
                .locator('.file-tree-root-drop-zone')
                .getAttribute('class');
        })
        .toContain('file-tree-root-drop-zone-active');
    await root.dispatchEvent('drop', { dataTransfer });
    await dataTransfer.dispose();
}

// Перетаскивание идёт отдельным путём от диалога выбора, проверяем и его
test('класс LaTeX перетаскиванием загружается без ошибки формата', async ({
    page,
}) => {
    const uploads = recordUploads(page);
    await openFileManager(page);

    await dropFileToRoot(page, {
        name: 'altacv.cls',
        mimeType: '',
        body: '\\ProvidesClass{altacv}\n',
    });

    await expect.poll(() => uploads).toEqual(['altacv.cls']);
    await expect(toasts(page)).toHaveCount(0);
});

test('двоичный файл неизвестного формата перетаскиванием отклоняется', async ({
    page,
}) => {
    const uploads = recordUploads(page);
    await openFileManager(page);

    await dropFileToRoot(page, {
        name: 'archive.zip',
        mimeType: 'application/zip',
        body: 'PK\u0003\u0004\u0014\u0000\u0000\u0000',
    });

    await expect(toasts(page)).toContainText('Media type is not supported');
    expect(uploads).toEqual([]);
});
