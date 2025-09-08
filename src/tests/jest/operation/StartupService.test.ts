import {
    matchRepositorySnapshot,
    mockContext,
    mockS3LabsFileForDefaultLab,
    mockUserInfoForUnauthorized,
} from '../common.ts';

/*
Сценарий:
1. Заходим на сайт с авторизацией
 */
test('onAppStartup-qr-test', async () => {
    const { startupService, rpi, repository } = mockContext();
    mockS3LabsFileForDefaultLab(rpi);
    mockUserInfoForUnauthorized(rpi);
    repository.setLocation('/qr/v1');
    await startupService.onAppStartup();

    matchRepositorySnapshot(repository);
});
