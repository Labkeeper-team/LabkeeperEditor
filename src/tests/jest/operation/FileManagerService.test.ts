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
