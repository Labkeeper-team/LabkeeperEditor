import {
    matchRepositorySnapshot,
    mockAuthenticatedStartup,
    mockContext,
    mockUserInfoForUnauthorized,
} from '../common.ts';

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
        'my_folder/note.txt'
    );
});

test('file-manager-test-onUploadFiles-with-empty-folder-prefix', async () => {
    const { startupService, fileManagerService, rpi, repository } =
        mockContext();
    mockAuthenticatedStartup(rpi);

    await startupService.onAppStartup();
    repository.settingsViewModelRepository.setCurrentFolderPath('old_folder');

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

    await fileManagerService.onUploadFiles([file], '');

    expect(rpi.uploadFileRequest).toHaveBeenCalledWith(
        expect.any(FormData),
        expect.any(String),
        'note.txt'
    );
});

test('file-manager-test-onUploadFiles-resets-stale-current-folder', async () => {
    const { startupService, fileManagerService, rpi, repository } =
        mockContext();
    mockAuthenticatedStartup(rpi);

    await startupService.onAppStartup();
    repository.settingsViewModelRepository.setCurrentFolderPath(
        'removed_folder'
    );

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

    await fileManagerService.onUploadFiles([file]);

    expect(repository.settingsViewModelRepository.currentFolderPath()).toBe('');
    expect(rpi.uploadFileRequest).toHaveBeenCalledWith(
        expect.any(FormData),
        expect.any(String),
        'note.txt'
    );
});

test('file-manager-test-onUploadFiles-rejects-invalid-file-name', async () => {
    const { startupService, fileManagerService, rpi, repository } =
        mockContext();
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
        name: 'a/.txt',
        size: 128,
        type: 'text/plain',
    } as File;
    const toastSpy = jest.spyOn(repository, 'toast');

    await fileManagerService.onUploadFiles([file]);

    expect(rpi.uploadFileRequest).not.toHaveBeenCalled();
    expect(toastSpy).toHaveBeenCalledTimes(1);
    expect(toastSpy).toHaveBeenCalledWith(
        repository.dictionary.filemanager.errors.bad_name,
        'error'
    );
    expect(repository.ideViewModelRepository.getFilesRequestState()).toBe('ok');
});

test('file-manager-test-onFileNameChanged-updates-open-text-file', async () => {
    const { startupService, fileManagerService, rpi, repository } =
        mockContext();
    mockAuthenticatedStartup(rpi);

    await startupService.onAppStartup();

    rpi.renameFileRequest = jest.fn().mockResolvedValue({
        code: 200,
        body: '',
        isOk: true,
        isUnauth: false,
        isForbidden: false,
    });
    rpi.uploadFileRequest = jest.fn().mockResolvedValue({
        code: 200,
        body: '',
        isOk: true,
        isUnauth: false,
        isForbidden: false,
    });

    repository.ideViewModelRepository.setActiveTextFile('note.txt');
    repository.ideViewModelRepository.setTextFileContent('edited content');

    await fileManagerService.onFileNameChanged('note.txt', 'renamed.txt');

    expect(repository.ideViewModelRepository.activeTextFile()).toBe(
        'renamed.txt'
    );
    expect(rpi.uploadFileRequest).toHaveBeenCalledWith(
        expect.any(FormData),
        expect.any(String),
        'renamed.txt'
    );
});

test('file-manager-test-onFileNameChanged-rejects-path-in-file-name', async () => {
    const { startupService, fileManagerService, rpi, repository } =
        mockContext();
    mockAuthenticatedStartup(rpi);
    await startupService.onAppStartup();

    rpi.renameFileRequest = jest.fn().mockResolvedValue({
        code: 200,
        body: '',
        isOk: true,
        isUnauth: false,
        isForbidden: false,
    });
    const toastSpy = jest.spyOn(repository, 'toast');

    await fileManagerService.onFileNameChanged('note.txt', 'a/.txt');

    expect(rpi.renameFileRequest).not.toHaveBeenCalled();
    expect(toastSpy).toHaveBeenCalledTimes(1);
    expect(toastSpy).toHaveBeenCalledWith(
        repository.dictionary.filemanager.errors.bad_name,
        'error'
    );
});

test('file-manager-test-onFileNameChanged-shows-bad-name-for-400', async () => {
    const { startupService, fileManagerService, rpi, repository } =
        mockContext();
    mockAuthenticatedStartup(rpi);
    await startupService.onAppStartup();

    rpi.renameFileRequest = jest.fn().mockResolvedValue({
        code: 400,
        body: '',
        isOk: false,
        isUnauth: false,
        isForbidden: false,
    });
    const toastSpy = jest.spyOn(repository, 'toast');

    await fileManagerService.onFileNameChanged('note.txt', 'renamed.txt');

    expect(toastSpy).toHaveBeenCalledTimes(1);
    expect(toastSpy).toHaveBeenCalledWith(
        repository.dictionary.filemanager.errors.bad_name,
        'error'
    );
    expect(repository.ideViewModelRepository.getFilesRequestState()).toBe('ok');
});

test('file-manager-test-onFileNameChanged-shows-rename-error-for-500', async () => {
    const { startupService, fileManagerService, rpi, repository } =
        mockContext();
    mockAuthenticatedStartup(rpi);
    await startupService.onAppStartup();

    rpi.renameFileRequest = jest.fn().mockResolvedValue({
        code: 500,
        body: '',
        isOk: false,
        isUnauth: false,
        isForbidden: false,
    });
    const toastSpy = jest.spyOn(repository, 'toast');

    await fileManagerService.onFileNameChanged('note.txt', 'renamed.txt');

    expect(toastSpy).toHaveBeenCalledTimes(1);
    expect(toastSpy).toHaveBeenCalledWith(
        repository.dictionary.filemanager.errors.rename_file_failed,
        'error'
    );
    expect(repository.ideViewModelRepository.getFilesRequestState()).toBe('ok');
});
