import {
    expect,
    test,
    type Browser,
    type BrowserContext,
    type Page,
} from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';
import { FakeCollabAuthority } from '../collab/fakeCollabAuthority.ts';
import type { CollabClientFrame } from '../../model/rpi/collabSocket.ts';

/*
 * Collaborative editing of project files with two users in two browser contexts against
 * one in-test fake collaboration authority: the WebSocket is mocked with routeWebSocket,
 * the collab upload endpoint and the file storage with page.route. Owner alice and bob,
 * a signed-in guest with the link, open the same public project.
 */

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';
const OWNER_ID = 2;
const SEGMENT = 'see notes.txt';

// a 1x1 picture: the browser needs an image answer, the pixels do not matter
const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64'
);

const USERS = {
    alice: { id: OWNER_ID, email: 'alice@example.com', color: '#e8590c' },
    bob: { id: 1, email: 'bob@example.com', color: '#1971c2' },
} as const;

type UserName = keyof typeof USERS;

const VIEWPORTS = [
    { name: 'desktop', viewport: { width: 1400, height: 900 }, mobile: false },
    { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
] as const;

type Viewport = (typeof VIEWPORTS)[number];

/** Binary file contents served by the storage mock, by path */
type Binaries = Map<string, Buffer>;

function collectErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on('console', (message) => {
        if (
            message.type() === 'error' &&
            !message.text().includes('Invalid Sentry Dsn')
        ) {
            errors.push(message.text());
        }
    });
    page.on('pageerror', (error) => errors.push(String(error)));
    return errors;
}

/** File name and content of a multipart body with one `file` part */
function multipartFile(body: Buffer, contentType: string): Buffer | null {
    const boundary = contentType.match(/boundary=(.+)$/)?.[1];
    if (!boundary) {
        return null;
    }
    const text = body.toString('latin1');
    const start = text.indexOf('\r\n\r\n');
    const end = text.indexOf(`\r\n--${boundary}`, start);
    if (start < 0 || end < 0) {
        return null;
    }
    return Buffer.from(text.slice(start + 4, end), 'latin1');
}

async function openAs(
    browser: Browser,
    name: UserName,
    authority: FakeCollabAuthority,
    binaries: Binaries,
    viewport: Viewport
): Promise<{ context: BrowserContext; page: Page; errors: string[] }> {
    const user = USERS[name];
    const context = await browser.newContext({
        viewport: viewport.viewport,
        isMobile: viewport.mobile,
        hasTouch: viewport.mobile,
    });
    const page = await context.newPage();
    const errors = collectErrors(page);
    await page.addInitScript(() => {
        window.localStorage.setItem('labkeeper_analytics_disabled', '1');
    });
    const routes = new RouteSetup(page);
    await routes.setupApi();
    await routes.setupGetUserInfoRequest(true, user.email, user.id);
    await routes.setupGetAllProjectsRequest();
    await routes.setupSaveProgramRequest();
    await routes.setupListFilesRequest(200, 'emptyFiles');
    await routes.setupAgentHistoryRequest([]);
    await routes.setupListHunksRequest([]);
    await page.route(`**/api/v4/public/project/${uuid}/get**`, (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                projectId: uuid,
                userId: OWNER_ID,
                title: 'Shared project',
                lastModified: new Date().toISOString(),
                isPublic: true,
                projectType: 'markdown',
                lastProgramResult: { segments: [] },
                program: {
                    segments: [
                        {
                            id: 1,
                            type: 'md',
                            parameters: { visible: true },
                            text: SEGMENT,
                        },
                    ],
                    parameters: { roundStrategy: 'noRound' },
                },
            }),
        })
    );
    // the storage: text files from the authority, pictures from the test
    await page.route('http://collab-files.test/**', (route) => {
        const path = authority.pathOfUrl(route.request().url());
        const binary = path ? binaries.get(path) : undefined;
        if (binary) {
            return route.fulfill({ contentType: 'image/png', body: binary });
        }
        const content = path ? authority.fileContent(path) : undefined;
        return content === undefined
            ? route.fulfill({ status: 404, body: '' })
            : route.fulfill({ contentType: 'text/plain', body: content });
    });
    // PUT /collab/file/upload as the participant of its connection
    await page.route(
        `**/api/v4/public/project/${uuid}/collab/file/upload**`,
        (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const name = (url.searchParams.get('name') ?? '').replace(
                /^\//,
                ''
            );
            const content = multipartFile(
                request.postDataBuffer() ?? Buffer.alloc(0),
                request.headers()['content-type'] ?? ''
            );
            if (content && name.endsWith('.png')) {
                binaries.set(name, content);
            }
            const status = authority.upload(
                url.searchParams.get('connectionId') ?? '',
                name,
                content?.toString('utf8') ?? ''
            );
            return route.fulfill({
                status,
                contentType: 'application/json',
                body: JSON.stringify(authority.fileUrl(name)),
            });
        }
    );
    let connections = 0;
    await page.routeWebSocket(/\/api\/v4\/ws\/project\/[^/]+\/collab/, (ws) => {
        connections += 1;
        const connectionId = `${name}-${connections}`;
        ws.onMessage((message) =>
            authority.receive(
                connectionId,
                JSON.parse(String(message)) as CollabClientFrame
            )
        );
        ws.onClose(() => authority.disconnect(connectionId));
        authority.connect({
            connectionId,
            userId: user.id,
            displayName: name,
            color: user.color,
            send: (frame) => {
                try {
                    ws.send(JSON.stringify(frame));
                } catch {
                    // the page is gone
                }
            },
            close: (code) => void ws.close({ code }),
        });
    });
    await page.goto(`/project/${uuid}`);
    await expect(page.getByTestId('collab-participant').first()).toBeVisible({
        timeout: 30_000,
    });
    return { context, page, errors };
}

async function showFiles(page: Page, viewport: Viewport): Promise<void> {
    if (viewport.mobile) {
        await page.locator('.mobile-view-switcher-bar__toggle').click();
        await page.getByRole('option', { name: 'Files' }).click();
    } else {
        await page.locator('div.file-manager-button').click();
    }
    await expect(page.locator('.file-tree-view')).toBeVisible();
}

const fileRow = (page: Page, name: string) =>
    page.locator('.file-tree-user-branch .tree-row-file', {
        has: page.getByText(name, { exact: true }),
    });

async function fileMenu(page: Page, name: string, item: 'Edit' | 'Delete') {
    await fileRow(page, name).locator('.dropdown-menu-container').click();
    const menu = page.locator('.dropdown-menu-content-container').last();
    await menu.locator('.tree-menu-item', { hasText: item }).first().click();
}

const textEditor = (page: Page) =>
    page.locator('.text-file-editor-body .cm-content');

/** Text of the text file editor without the remote caret labels */
async function editorText(page: Page): Promise<string> {
    return textEditor(page).evaluate((element) =>
        Array.from(element.querySelectorAll('.cm-line'))
            .map((line) => {
                const clone = line.cloneNode(true) as HTMLElement;
                clone
                    .querySelectorAll('.cm-collab-caret')
                    .forEach((caret) => caret.remove());
                return clone.textContent ?? '';
            })
            .join('\n')
    );
}

async function openFile(page: Page, viewport: Viewport, name: string) {
    await fileRow(page, name).click();
    await expect(textEditor(page)).toBeVisible({ timeout: 15_000 });
    if (viewport.mobile) {
        await expect(page.locator('.text-file-editor-title')).toHaveText(name);
    }
}

for (const viewport of VIEWPORTS) {
    test(`two-users-share-file-changes-${viewport.name}`, async ({
        browser,
    }) => {
        test.setTimeout(120_000);
        const binaries: Binaries = new Map([['figure.png', PNG]]);
        const authority = new FakeCollabAuthority({
            segments: [{ type: 'md', text: SEGMENT }],
            files: [
                { path: 'notes.txt', content: 'first line' },
                { path: 'figure.png', content: 'png' },
            ],
        });
        const alice = await openAs(
            browser,
            'alice',
            authority,
            binaries,
            viewport
        );
        const bob = await openAs(browser, 'bob', authority, binaries, viewport);
        for (const user of [alice, bob]) {
            await showFiles(user.page, viewport);
            await expect(fileRow(user.page, 'notes.txt')).toBeVisible();
            await expect(fileRow(user.page, 'figure.png')).toBeVisible();
        }

        // bob, the guest, creates a file: alice sees it
        await bob.page.getByRole('button', { name: 'Create file' }).click();
        await expect.poll(() => authority.filePaths()).toContain('new.txt');
        if (viewport.mobile) {
            await showFiles(bob.page, viewport);
        }
        await expect(fileRow(alice.page, 'new.txt')).toBeVisible();

        // bob renames it: alice sees the new name
        await fileMenu(bob.page, 'new.txt', 'Edit');
        const input = bob.page.locator('.tree-row-label-editing input');
        await input.fill('todo.txt');
        await input.press('Enter');
        await expect(fileRow(alice.page, 'todo.txt')).toBeVisible();
        await expect(fileRow(alice.page, 'new.txt')).toHaveCount(0);

        // alice deletes it: it disappears at bob's
        await fileMenu(alice.page, 'todo.txt', 'Delete');
        await expect(fileRow(bob.page, 'todo.txt')).toHaveCount(0);
        expect(authority.filePaths()).toEqual(['figure.png', 'notes.txt']);

        // bob uploads a file: alice sees it, the storage has its content
        await bob.page
            .locator('.file-tree-toolbar input[type="file"]')
            .setInputFiles({
                name: 'data.csv',
                mimeType: 'text/csv',
                buffer: Buffer.from('a,b\n1,2'),
            });
        await expect(fileRow(alice.page, 'data.csv')).toBeVisible();
        expect(authority.fileContent('data.csv')).toBe('a,b\n1,2');

        // a picture replaced by an upload of somebody else is shown anew
        await fileRow(alice.page, 'figure.png').click();
        const image = alice.page.locator('.image-file-preview-image');
        await expect(image).toBeVisible();
        const before = await image.getAttribute('src');
        binaries.set('figure.png', Buffer.concat([PNG]));
        const bobConnection = authority
            .connectionIds()
            .find((id) => id.startsWith('bob-'))!;
        expect(authority.upload(bobConnection, 'figure.png', 'png2')).toBe(201);
        await expect(image).not.toHaveAttribute('src', before ?? '');
        await expect(image).toHaveAttribute('src', /lkrev=1/);

        expect(alice.errors).toEqual([]);
        expect(bob.errors).toEqual([]);
        await alice.context.close();
        await bob.context.close();
    });

    test(`two-users-co-edit-a-text-file-with-cursors-${viewport.name}`, async ({
        browser,
    }) => {
        test.setTimeout(120_000);
        const authority = new FakeCollabAuthority({
            segments: [{ type: 'md', text: SEGMENT }],
            files: [{ path: 'notes.txt', content: 'first line' }],
        });
        const binaries: Binaries = new Map();
        const alice = await openAs(
            browser,
            'alice',
            authority,
            binaries,
            viewport
        );
        const bob = await openAs(browser, 'bob', authority, binaries, viewport);
        for (const user of [alice, bob]) {
            await showFiles(user.page, viewport);
            await openFile(user.page, viewport, 'notes.txt');
            await expect.poll(() => editorText(user.page)).toBe('first line');
        }
        // the guest's editor is writable
        await expect(textEditor(bob.page)).toHaveAttribute(
            'contenteditable',
            'true'
        );

        await textEditor(alice.page).click();
        await alice.page.keyboard.press('Control+End');
        await textEditor(bob.page).click();
        await bob.page.keyboard.press('Control+Home');
        await Promise.all([
            alice.page.keyboard.type(' by alice', { delay: 15 }),
            bob.page.keyboard.type('Bob: ', { delay: 15 }),
        ]);

        await expect
            .poll(async () => [
                await editorText(alice.page),
                await editorText(bob.page),
            ])
            .toEqual([
                authority.fileContent('notes.txt'),
                authority.fileContent('notes.txt'),
            ]);
        const final = authority.fileContent('notes.txt')!;
        expect(final).toContain('Bob: ');
        expect(final).toContain(' by alice');
        expect(final).toContain('first line');

        // each sees the other's caret with the name
        await expect(
            textEditor(alice.page).locator('.cm-collab-caret')
        ).toHaveAttribute('data-collab-name', 'bob');
        await expect(
            textEditor(bob.page).locator('.cm-collab-caret')
        ).toHaveAttribute('data-collab-name', 'alice');

        // the text goes through the document: no REST upload of the file
        const restUploads: string[] = [];
        alice.page.on('request', (request) => {
            if (request.url().includes('/file/upload')) {
                restUploads.push(request.url());
            }
        });
        await alice.page.keyboard.type('!');
        await expect
            .poll(() => authority.fileContent('notes.txt'))
            .toBe(`${final}!`);
        await alice.page.waitForTimeout(1500);
        expect(restUploads.filter((url) => !url.includes('/collab/'))).toEqual(
            []
        );

        // alice renames the file: bob's editor follows it and keeps the text
        if (viewport.mobile) {
            await showFiles(alice.page, viewport);
        }
        await fileMenu(alice.page, 'notes.txt', 'Edit');
        const input = alice.page.locator('.tree-row-label-editing input');
        await input.fill('notes2.txt');
        await input.press('Enter');
        await expect(bob.page.locator('.text-file-editor-title')).toHaveText(
            'notes2.txt'
        );
        await expect.poll(() => editorText(bob.page)).toBe(`${final}!`);
        // the reference in the segment follows the rename for everybody
        await expect.poll(() => authority.text(1)).toBe('see notes2.txt');

        // alice deletes it: bob's editor closes
        await fileMenu(alice.page, 'notes2.txt', 'Delete');
        await expect(textEditor(bob.page)).toHaveCount(0);

        expect(alice.errors).toEqual([]);
        expect(bob.errors).toEqual([]);
        await alice.context.close();
        await bob.context.close();
    });
}
