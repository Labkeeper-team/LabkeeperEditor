import {
    matchRepositorySnapshot,
    mockAuthenticatedStartup,
    mockContext,
    mockUserInfoForUnauthorized,
} from '../common.ts';

jest.mock('nanoid', () => ({
    nanoid: () => '12345678',
}));

/*
Сценарий:
1. Заходим на сайт с авторизацией
2. переходим на дефолтный проект
3. Нажимаем кнопку файлового менеджера
4. открывается файловый менеджер
 */
test('file-manager-test-onFolderButtonClicked-authorized', async () => {
    const { startupService, fileManagerService, rpi, repository } =
        mockContext();
    mockAuthenticatedStartup(rpi);

    await startupService.onAppStartup();

    await fileManagerService.onFolderButtonClicked();

    expect(repository.settingsViewModelRepository.showFileManager()).toBe(true);

    matchRepositorySnapshot(repository);
});

/*
Сценарий:
1. Заходим на сайт как инкогнито
2. переходим на дефолтный проект
3. Нажимаем кнопку файлового менеджера
4. открывается панель логина
 */
test('file-manager-test-onFolderButtonClicked-unauthorized-on-default', async () => {
    const { startupService, fileManagerService, repository, rpi } =
        mockContext();
    mockUserInfoForUnauthorized(rpi);
    await startupService.onAppStartup();
    await fileManagerService.onFolderButtonClicked();

    expect(repository.authViewModelRepository.currentView()).toBe('login');

    matchRepositorySnapshot(repository);
});

test('file-manager-test-onUploadFiles-csv-with-empty-mime', async () => {
    const { startupService, fileManagerService, rpi } = mockContext();
    mockAuthenticatedStartup(rpi);

    await startupService.onAppStartup();

    rpi.uploadFileRequest = jest.fn().mockResolvedValue({
        code: 200,
        body: '',
        isOk: true,
        isUnauth: false,
        isForbidden: false,
    });

    const file = {
        name: 'Frequency.csv',
        size: 1024,
        type: '',
    } as File;

    await fileManagerService.onUploadFiles([file]);

    expect(rpi.uploadFileRequest).toHaveBeenCalledTimes(1);
});

test('file-manager-test-onUploadFiles-with-folder-prefix', async () => {
    const { startupService, fileManagerService, rpi } = mockContext();
    mockAuthenticatedStartup(rpi);

    await startupService.onAppStartup();

    rpi.uploadFileRequest = jest.fn().mockResolvedValue({
        code: 200,
        body: '',
        isOk: true,
        isUnauth: false,
        isForbidden: false,
    });

    const file = {
        name: 'note.txt',
        size: 128,
        type: 'text/plain',
    } as File;

    await fileManagerService.onUploadFiles([file], 'my_folder');

    expect(rpi.uploadFileRequest).toHaveBeenCalledWith(
        expect.any(FormData),
        expect.any(String),
        'my_folder/note_12345678.txt'
    );
});
