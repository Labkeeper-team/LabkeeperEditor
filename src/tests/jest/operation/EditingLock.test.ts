import {
    mockContext,
    mockSaveProgramRequest,
    PROJECT_ID,
    PROJECT_TITLE,
    USER_ID,
} from '../common.ts';
import { en } from '../../../viewModel/dictionaries/en.ts';
import { MockViewModelRepository } from '../../../viewModel/repository';

const okResult = <T>(body: T) => ({
    code: 200,
    body,
    isOk: true,
    isUnauth: false,
    isForbidden: false,
});

function setup() {
    const ctx = mockContext();
    ctx.repository.userViewModelRepository.setUserInfo({
        isAuthenticated: true,
        email: 'a@gmail.com',
        id: USER_ID,
        privacyPolicyAccepted: true,
        crossBorderDataTransferPolicyAccepted: true,
        tokenBalance: 10,
    });
    ctx.repository.projectViewModelRepository.setProject({
        projectId: PROJECT_ID,
        userId: USER_ID,
        title: PROJECT_TITLE,
        lastModified: '2026-09-06T14:00:00Z',
        isPublic: false,
        projectType: 'markdown',
        program: { segments: [], parameters: { roundStrategy: 'noRound' } },
    });
    ctx.repository.projectViewModelRepository.setReadOnly(false);
    ctx.rpi.listHunksRequest = jest
        .fn()
        .mockResolvedValue(okResult({ hunks: [] }));
    ctx.rpi.listFilesRequest = jest
        .fn()
        .mockResolvedValue(okResult({ files: [] }));
    mockSaveProgramRequest(ctx.rpi);
    return ctx;
}

type Ctx = ReturnType<typeof setup>;

async function startAgent(ctx: Ctx) {
    ctx.repository.chatViewModelRepository.setInput('поправь таблицу');
    await ctx.agentChatService.onPromptSubmit();
}

const toasts = (ctx: Ctx) =>
    (ctx.repository as MockViewModelRepository).mockState().toasts;
const LOCKED_TEXT = en.agent_chat.editing_locked;

test('editing-is-blocked-while-agent-runs', async () => {
    const ctx = setup();
    ctx.programEditorService.onAddSegmentClicked('md');
    await startAgent(ctx);
    const segmentsBefore =
        ctx.repository.projectViewModelRepository.currentProgram().segments
            .length;

    ctx.programEditorService.onAddSegmentClicked('md');
    await ctx.programEditorService.deleteSegment(0);
    await ctx.programEditorService.segmentEditorChangeSegmentPosition('up', 0);

    expect(
        ctx.repository.projectViewModelRepository.currentProgram().segments
    ).toHaveLength(segmentsBefore);
    expect(toasts(ctx)[0]).toEqual({ message: LOCKED_TEXT, type: 'info' });
});

test('blocked-edit-shows-message-once', async () => {
    const ctx = setup();
    await startAgent(ctx);

    // зажатая клавиша даёт поток попыток, тостов должен остаться один
    for (let attempt = 0; attempt < 10; attempt += 1) {
        ctx.agentChatService.onBlockedEditAttempt();
    }

    expect(
        toasts(ctx).filter((item) => item.message === LOCKED_TEXT)
    ).toHaveLength(1);
});

test('editing-unlocks-after-agent-finished', async () => {
    const ctx = setup();
    await startAgent(ctx);
    await ctx.agentSocketState.handlers?.onEvent({
        kind: 'finished',
        message: 'готово',
        stopReason: 'Done',
    });

    ctx.programEditorService.onAddSegmentClicked('md');

    expect(
        ctx.repository.projectViewModelRepository.currentProgram().segments
    ).toHaveLength(1);
});

test('editing-unlocks-after-connection-drop', async () => {
    const ctx = setup();
    await startAgent(ctx);
    ctx.agentSocketState.handlers?.onClosed('closed');

    ctx.programEditorService.onAddSegmentClicked('md');

    expect(
        ctx.repository.projectViewModelRepository.currentProgram().segments
    ).toHaveLength(1);
});

test('run-button-is-blocked-while-agent-runs', async () => {
    const ctx = setup();
    ctx.rpi.compilationRequest = jest.fn();
    await startAgent(ctx);

    await ctx.projectPageService.onRunButtonClicked();

    expect(ctx.rpi.compilationRequest).not.toHaveBeenCalled();
    expect(toasts(ctx)[0]).toEqual({ message: LOCKED_TEXT, type: 'info' });
});

test('file-manager-is-blocked-while-agent-runs', async () => {
    const ctx = setup();
    ctx.rpi.deleteFileRequest = jest.fn();
    ctx.rpi.uploadFileRequest = jest.fn();
    await startAgent(ctx);

    await ctx.fileManagerService.onDeleteFile('table.xml');
    await ctx.fileManagerService.onUploadFiles([
        new File(['1'], 'a.txt', { type: 'text/plain' }),
    ]);

    expect(ctx.rpi.deleteFileRequest).not.toHaveBeenCalled();
    expect(ctx.rpi.uploadFileRequest).not.toHaveBeenCalled();
});

test('text-file-typing-is-blocked-while-agent-runs', async () => {
    const ctx = setup();
    await startAgent(ctx);
    const revisionBefore =
        ctx.repository.ideViewModelRepository.textFileChangeRevision();

    ctx.textFileEditorService.onTextFileContentChanged('новый текст');

    expect(ctx.repository.ideViewModelRepository.textFileChangeRevision()).toBe(
        revisionBefore
    );
});

test('program-autosave-does-not-fire-while-agent-runs', async () => {
    const ctx = setup();
    ctx.programEditorService.onAddSegmentClicked('md');
    await startAgent(ctx);
    (ctx.rpi.saveProgramRequest as jest.Mock).mockClear();

    await ctx.programEditorService.onProgramSaveTimeout();

    expect(ctx.rpi.saveProgramRequest).not.toHaveBeenCalled();
    // таймер молчит молча, лишнего сообщения быть не должно
    expect(toasts(ctx)).toHaveLength(0);
});

test('hunk-accept-is-blocked-while-agent-runs', async () => {
    const ctx = setup();
    ctx.rpi.deleteHunkRequest = jest.fn();
    await startAgent(ctx);

    await ctx.hunkService.acceptGroup(['h1']);
    await ctx.hunkService.revertAll();

    expect(ctx.rpi.deleteHunkRequest).not.toHaveBeenCalled();
});

test('pending-saves-are-flushed-despite-the-lock', async () => {
    const ctx = setup();
    ctx.programEditorService.onAddSegmentClicked('md');
    await ctx.programEditorService.onSegmentTextEdited(0, 'текст');
    (ctx.rpi.saveProgramRequest as jest.Mock).mockClear();

    await startAgent(ctx);

    // блокировка встаёт до сохранения, но собственный путь сохранения обязан пройти
    expect(ctx.rpi.saveProgramRequest).toHaveBeenCalled();
});

test('save-hotkey-under-the-lock-explains-itself', async () => {
    const ctx = setup();
    ctx.rpi.uploadFileRequest = jest.fn();
    await startAgent(ctx);

    // сюда приходит Ctrl+S, молчаливый отказ выглядит как сломанная программа
    await ctx.textFileEditorService.onTextFileSaveTimeout();

    expect(ctx.rpi.uploadFileRequest).not.toHaveBeenCalled();
    expect(toasts(ctx)[0]).toEqual({ message: LOCKED_TEXT, type: 'info' });
});

test('help-menu-cannot-add-a-segment-while-agent-runs', async () => {
    const ctx = setup();
    await startAgent(ctx);
    const before =
        ctx.repository.projectViewModelRepository.currentProgram().segments
            .length;

    // меню подсказок в шапке добавляет сегмент мимо редактора, замок нужен и там
    ctx.projectPageService.onHelpItemCreated({
        segmentType: 'md',
        text: { ru: 'таблица', en: 'table' },
    } as Parameters<typeof ctx.projectPageService.onHelpItemCreated>[0]);

    expect(
        ctx.repository.projectViewModelRepository.currentProgram().segments
    ).toHaveLength(before);
    expect(toasts(ctx)[0]).toEqual({ message: LOCKED_TEXT, type: 'info' });
});
