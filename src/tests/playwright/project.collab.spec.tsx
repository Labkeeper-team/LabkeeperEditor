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
 * Collaborative editing with two users in two browser contexts against one in-test
 * fake collaboration authority (the WebSocket is mocked with routeWebSocket, REST with
 * page.route). Owner alice (user 2) and bob (user 1, another account) open the same
 * public project.
 */

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';
const OWNER_ID = 2;
const INITIAL = ['# Shared notes\n\nfirst line', 'a = 10'];

const USERS = {
    alice: { id: OWNER_ID, email: 'alice@example.com', color: '#e8590c' },
    bob: { id: 1, email: 'bob@example.com', color: '#1971c2' },
} as const;

type UserName = keyof typeof USERS;

const VIEWPORTS = [
    { name: 'desktop', viewport: { width: 1400, height: 900 }, mobile: false },
    { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
] as const;

/** Console errors and page errors of a page; the test expects none */
function collectErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on('console', (message) => {
        // the dev build has no Sentry DSN, that is not an error of the page
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

async function openAs(
    browser: Browser,
    name: UserName,
    authority: FakeCollabAuthority,
    viewport: (typeof VIEWPORTS)[number]
): Promise<{
    context: BrowserContext;
    page: Page;
    errors: string[];
    dropOpenConnections: () => void;
    connectionCount: () => number;
}> {
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
    await routes.setupGetProjectRequest(200, 'default');
    await routes.setupGetAllProjectsRequest();
    await routes.setupSaveProgramRequest();
    await routes.setupListFilesRequest(200, 'emptyFiles');
    await routes.setupAgentHistoryRequest([]);
    // a public project of alice: bob is a guest with the link
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
                            text: INITIAL[0],
                        },
                        {
                            id: 2,
                            type: 'computational',
                            parameters: { visible: true },
                            text: INITIAL[1],
                        },
                    ],
                    parameters: { roundStrategy: 'noRound' },
                },
            }),
        })
    );
    let connections = 0;
    const open = new Set<string>();
    await page.routeWebSocket(/\/api\/v4\/ws\/project\/[^/]+\/collab/, (ws) => {
        connections += 1;
        const connectionId = `${name}-${connections}`;
        ws.onMessage((message) =>
            authority.receive(
                connectionId,
                JSON.parse(String(message)) as CollabClientFrame
            )
        );
        open.add(connectionId);
        ws.onClose(() => {
            open.delete(connectionId);
            authority.disconnect(connectionId);
        });
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
            close: (code) => {
                open.delete(connectionId);
                void ws.close({ code, reason: 'participantLimit' });
            },
        });
    });
    await page.goto(`/project/${uuid}`);
    return {
        context,
        page,
        errors,
        connectionCount: () => connections,
        dropOpenConnections: () => {
            for (const connectionId of open) {
                authority.disconnect(connectionId);
            }
            open.clear();
        },
    };
}

const segmentContent = (page: Page, index: number) =>
    page.locator('.segment-editor-container .cm-content').nth(index);

async function textOf(page: Page, index: number): Promise<string> {
    return segmentContent(page, index).evaluate((element) => {
        const lines = Array.from(element.querySelectorAll('.cm-line'));
        return lines
            .map((line) => {
                const clone = line.cloneNode(true) as HTMLElement;
                // remote caret labels are widgets, not text
                clone
                    .querySelectorAll('.cm-collab-caret')
                    .forEach((caret) => caret.remove());
                return clone.textContent ?? '';
            })
            .join('\n');
    });
}

for (const viewport of VIEWPORTS) {
    test(`two-users-edit-the-same-segment-and-see-each-other-${viewport.name}`, async ({
        browser,
    }, testInfo) => {
        test.setTimeout(90_000);
        const authority = new FakeCollabAuthority({
            segments: [
                { type: 'md', text: INITIAL[0] },
                { type: 'computational', text: INITIAL[1] },
            ],
        });
        const alice = await openAs(browser, 'alice', authority, viewport);
        const bob = await openAs(browser, 'bob', authority, viewport);

        for (const { page } of [alice, bob]) {
            await expect(
                page.locator('.segment-editor-container .cm-content')
            ).toHaveCount(2, { timeout: 30_000 });
            await expect(page.getByTestId('collab-participant')).toHaveCount(
                2,
                {
                    timeout: 15_000,
                }
            );
        }

        // both see the other with the server color; the own avatar comes first
        const bobAvatarAtAlice = alice.page.locator(
            `[data-testid="collab-participant"][data-user-id="${USERS.bob.id}"]`
        );
        await expect(bobAvatarAtAlice).toHaveCSS(
            'background-color',
            'rgb(25, 113, 194)'
        );
        await expect(bobAvatarAtAlice).toHaveAttribute('title', 'bob');
        await expect(
            bob.page.getByTestId('collab-participant').first()
        ).toHaveAttribute('title', 'bob (you)');

        // the guest of a public project may edit: the editor is not read-only
        await expect(segmentContent(bob.page, 0)).toHaveAttribute(
            'contenteditable',
            'true',
            { timeout: 15_000 }
        );
        await expect(segmentContent(alice.page, 0)).toHaveAttribute(
            'contenteditable',
            'true'
        );

        // both type into the same segment at the same time
        await segmentContent(alice.page, 0).click();
        await alice.page.keyboard.press('Control+End');
        await segmentContent(bob.page, 0).click();
        await bob.page.keyboard.press('Control+Home');
        await Promise.all([
            alice.page.keyboard.type(' alice was here', { delay: 15 }),
            bob.page.keyboard.type('Bob: ', { delay: 15 }),
        ]);

        // texts converge in both browsers and on the server
        await expect
            .poll(async () => [
                await textOf(alice.page, 0),
                await textOf(bob.page, 0),
            ])
            .toEqual([authority.text(1), authority.text(1)]);
        const final = authority.text(1);
        expect(final).toContain('alice was here');
        expect(final).toContain('Bob: ');
        expect(final).toContain('first line');
        expect(await textOf(alice.page, 0)).toBe(final);

        // bob's caret with his name is visible at alice's
        const caretAtAlice = segmentContent(alice.page, 0).locator(
            '.cm-collab-caret'
        );
        await expect(caretAtAlice).toHaveCount(1);
        await expect(caretAtAlice).toHaveAttribute('data-collab-name', 'bob');
        await expect(caretAtAlice.locator('.cm-collab-caret-label')).toHaveText(
            'bob'
        );
        await expect(caretAtAlice).toHaveCSS(
            'border-left-color',
            'rgb(25, 113, 194)'
        );
        // and alice's at bob's
        await expect(
            segmentContent(bob.page, 0).locator('.cm-collab-caret')
        ).toHaveAttribute('data-collab-name', 'alice');

        // a selection of bob is highlighted at alice's
        await bob.page.keyboard.press('Shift+End');
        await expect(
            segmentContent(alice.page, 0).locator('.cm-collab-selection')
        ).not.toHaveCount(0);

        await alice.page.screenshot({
            path: testInfo.outputPath(`alice-${viewport.name}.png`),
        });
        await bob.page.screenshot({
            path: testInfo.outputPath(`bob-${viewport.name}.png`),
        });

        // bob leaves: his caret and avatar disappear at alice's
        await bob.context.close();
        // routeWebSocket does not report a socket closed with its page; a real server sees
        // the TCP close, so the fake authority is told explicitly
        bob.dropOpenConnections();
        await expect(caretAtAlice).toHaveCount(0);
        await expect(alice.page.getByTestId('collab-participant')).toHaveCount(
            1
        );

        // the owner keeps editing alone; no console errors anywhere
        await segmentContent(alice.page, 0).focus();
        await alice.page.keyboard.press('Control+End');
        await alice.page.keyboard.type(' solo');
        await expect.poll(() => authority.text(1)).toBe(`${final} solo`);
        expect(alice.errors).toEqual([]);
        expect(bob.errors).toEqual([]);
        await alice.context.close();
    });
}

test('segment-add-by-one-user-appears-for-the-other', async ({ browser }) => {
    test.setTimeout(90_000);
    const authority = new FakeCollabAuthority({
        segments: [
            { type: 'md', text: INITIAL[0] },
            { type: 'computational', text: INITIAL[1] },
        ],
    });
    const alice = await openAs(browser, 'alice', authority, VIEWPORTS[0]);
    const bob = await openAs(browser, 'bob', authority, VIEWPORTS[0]);
    for (const { page } of [alice, bob]) {
        await expect(page.getByTestId('collab-participant')).toHaveCount(2, {
            timeout: 30_000,
        });
    }
    // bob, the guest, moves the second segment up through a server command
    await segmentContent(bob.page, 1).hover();
    await bob.page
        .locator('.segment-editor-container')
        .nth(1)
        .locator('.change-position-button')
        .first()
        .click();
    await expect
        .poll(() => authority.texts())
        .toEqual([INITIAL[1], INITIAL[0]]);
    for (const { page } of [alice, bob]) {
        await expect.poll(() => textOf(page, 0)).toBe(INITIAL[1]);
        await expect.poll(() => textOf(page, 1)).toBe(INITIAL[0]);
    }
    expect(alice.errors).toEqual([]);
    expect(bob.errors).toEqual([]);
    await alice.context.close();
    await bob.context.close();
});

test('without-a-collab-server-the-editor-stays-editable', async ({ page }) => {
    test.setTimeout(60_000);
    const routes = new RouteSetup(page);
    await routes.setupApi();
    await routes.setupGetUserInfoRequest(true, USERS.alice.email, OWNER_ID);
    await routes.setupGetProjectRequest(200, 'withTwoSegmentsBibaAndAEqualTen');
    await routes.setupGetAllProjectsRequest();
    await routes.setupSaveProgramRequest();
    await routes.setupListFilesRequest(200, 'emptyFiles');
    await routes.setupAgentHistoryRequest([]);
    const sockets: string[] = [];
    page.on('websocket', (socket) => sockets.push(socket.url()));
    await page.goto(`/project/${uuid}`);
    await expect(
        page.locator('.segment-editor-container .cm-content')
    ).toHaveCount(2, { timeout: 30_000 });
    await segmentContent(page, 0).click();
    await page.keyboard.type('x');
    await expect(segmentContent(page, 0)).toContainText('x');
    // collaboration is always on: the socket is tried, fails and the editor works alone
    expect(
        sockets.filter((url) => url.includes('/collab')).length
    ).toBeGreaterThan(0);
    await expect(page.getByTestId('collab-participants')).toHaveCount(0);
});

test('a-user-over-the-participant-limit-sees-a-message-and-is-not-reconnected', async ({
    browser,
}) => {
    test.setTimeout(90_000);
    const authority = new FakeCollabAuthority({
        segments: [
            { type: 'md', text: INITIAL[0] },
            { type: 'computational', text: INITIAL[1] },
        ],
        maxParticipants: 1,
    });
    const alice = await openAs(browser, 'alice', authority, VIEWPORTS[0]);
    await expect(alice.page.getByTestId('collab-participant')).toHaveCount(1, {
        timeout: 30_000,
    });
    const bob = await openAs(browser, 'bob', authority, VIEWPORTS[1]);
    const notice = bob.page.getByTestId('collab-participant-limit');
    await expect(notice).toBeVisible({ timeout: 30_000 });
    await expect(notice).toHaveText(
        'This project already has 1 people editing. Try again when someone leaves.'
    );
    // the editor works as without collaboration: the text is there, no participant list
    await expect(segmentContent(bob.page, 0)).toContainText('Shared notes');
    await expect(bob.page.getByTestId('collab-participants')).toHaveCount(0);
    // 1008 is not retried
    const connections = bob.connectionCount();
    await bob.page.waitForTimeout(3000);
    expect(bob.connectionCount()).toBe(connections);
    await expect(alice.page.getByTestId('collab-participant')).toHaveCount(1);
    await bob.page.screenshot({
        path: test.info().outputPath('bob-limit-phone.png'),
    });
    expect(bob.errors).toEqual([]);
    await alice.context.close();
    await bob.context.close();
});
