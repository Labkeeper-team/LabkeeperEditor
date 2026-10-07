import {
    mockAuthenticatedStartup,
    mockContext,
    mockUserInfoForUnauthorized,
} from '../common.ts';
import { Events } from '../../../model/service/ObserverService.ts';
import { isMentionedOnUpload } from '../../../viewModel/operation/AgentFilesService.ts';

const mention = (name: string) =>
    `Add the file ${name} that I uploaded to the document`;

const fileOf = (name: string, type: string) =>
    ({ name, size: 128, type }) as File;

const uploadResult = (code: number) => ({
    code,
    body: '',
    isOk: code < 300,
    isUnauth: false,
    isForbidden: false,
});

async function setup() {
    const context = mockContext();
    mockAuthenticatedStartup(context.rpi);
    await context.startupService.onAppStartup();
    context.rpi.uploadFileRequest = jest
        .fn()
        .mockResolvedValue(uploadResult(200));
    return {
        ...context,
        onEvent: jest.spyOn(context.observerService, 'onEvent'),
        chat: context.repository.chatViewModelRepository,
    };
}

test.each([
    ['report.pdf', true],
    ['Data.CSV', true],
    ['photo.png', true],
    ['photo.jpeg', true],
    ['scheme.svg', true],
    ['notes.txt', false],
    ['main.tex', false],
    ['refs.bib', false],
    ['altacv.cls', false],
])('после загрузки %s просьба к агенту: %s', (name, expected) => {
    expect(isMentionedOnUpload(name)).toBe(expected);
});

test('agent-files-upload-goes-to-project-root-and-asks-the-agent', async () => {
    const { agentFilesService, repository, rpi, chat, onEvent } = await setup();
    // в файловом менеджере была открыта существующая папка, но чат кладёт файл в корень
    repository.settingsViewModelRepository.setEphemeralFolders(['pictures']);
    repository.settingsViewModelRepository.setCurrentFolderPath('pictures');

    await agentFilesService.onFilesAdded(
        [fileOf('photo.png', 'image/png')],
        'drop'
    );

    expect(rpi.uploadFileRequest).toHaveBeenCalledWith(
        expect.any(FormData),
        expect.any(String),
        'photo.png'
    );
    expect(chat.input()).toBe(mention('photo.png'));
    expect(chat.recentFiles()).toEqual(['photo.png']);
    expect(onEvent).toHaveBeenCalledWith(
        Events.EVENT_FILE_UPLOADED,
        expect.objectContaining({
            file_count: 1,
            method: 'drop',
            source: 'agent_chat',
        })
    );
});

test('agent-files-upload-keeps-typed-prompt', async () => {
    const { agentFilesService, chat } = await setup();
    chat.setInput('Построй график по данным\n');

    await agentFilesService.onFilesAdded(
        [fileOf('data.csv', 'text/csv'), fileOf('plot.png', 'image/png')],
        'picker'
    );

    expect(chat.input()).toBe(
        [
            'Построй график по данным',
            mention('data.csv'),
            mention('plot.png'),
        ].join('\n')
    );
    // свежие первыми
    expect(chat.recentFiles()).toEqual(['plot.png', 'data.csv']);
});

test('agent-files-text-upload-does-not-touch-the-prompt', async () => {
    const { agentFilesService, rpi, chat } = await setup();
    chat.setInput('черновик');

    await agentFilesService.onFilesAdded(
        [fileOf('notes.txt', 'text/plain')],
        'picker'
    );

    expect(rpi.uploadFileRequest).toHaveBeenCalledTimes(1);
    expect(chat.input()).toBe('черновик');
    expect(chat.recentFiles()).toEqual(['notes.txt']);
});

test('agent-files-failed-upload-asks-nothing', async () => {
    const { agentFilesService, rpi, chat } = await setup();
    rpi.uploadFileRequest = jest.fn().mockResolvedValue(uploadResult(413));

    await agentFilesService.onFilesAdded(
        [fileOf('photo.png', 'image/png')],
        'picker'
    );

    expect(chat.input()).toBe('');
    expect(chat.recentFiles()).toEqual([]);
});

test('agent-files-only-uploaded-files-are-mentioned', async () => {
    const { agentFilesService, rpi, chat } = await setup();
    rpi.uploadFileRequest = jest
        .fn()
        .mockResolvedValueOnce(uploadResult(413))
        .mockResolvedValueOnce(uploadResult(200));

    await agentFilesService.onFilesAdded(
        [fileOf('big.png', 'image/png'), fileOf('ok.png', 'image/png')],
        'picker'
    );

    expect(chat.input()).toBe(mention('ok.png'));
});

test('agent-files-guest-gets-login-instead-of-upload', async () => {
    const context = mockContext();
    mockUserInfoForUnauthorized(context.rpi);
    await context.startupService.onAppStartup();
    context.rpi.uploadFileRequest = jest.fn();
    const onEvent = jest.spyOn(context.observerService, 'onEvent');

    await context.agentFilesService.onFilesAdded(
        [fileOf('photo.png', 'image/png')],
        'drop'
    );

    expect(context.rpi.uploadFileRequest).not.toHaveBeenCalled();
    expect(context.repository.authViewModelRepository.currentView()).toBe(
        'login'
    );
    expect(onEvent).toHaveBeenCalledWith(
        Events.EVENT_AUTH_MODAL_OPENED,
        expect.objectContaining({ source: 'agent_files' })
    );
    expect(context.repository.chatViewModelRepository.input()).toBe('');
});

test('agent-files-click-on-a-file-appends-the-request', async () => {
    const { agentFilesService, chat, onEvent } = await setup();
    chat.setInput('Сделай отчёт');

    agentFilesService.onFileMentioned('pictures/plot.PNG');
    agentFilesService.onFileMentioned('data.csv');

    expect(chat.input()).toBe(
        [
            'Сделай отчёт',
            mention('pictures/plot.PNG'),
            mention('data.csv'),
        ].join('\n')
    );
    expect(onEvent).toHaveBeenCalledWith(
        Events.EVENT_AGENT_FILE_MENTIONED,
        expect.objectContaining({ extension: 'png' })
    );
});
