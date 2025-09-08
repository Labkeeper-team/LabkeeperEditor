import {
    matchRepositorySnapshot,
    mockContext,
    mockUserInfoForUnauthorized,
} from '../common.ts';
import {
    CompileSuccessResult,
    TextOutputSegment,
} from '../../../model/domain.ts';

/*
Сценарий:
1. Зашли как авторизованный юзер
2. Создали comp
3. Создали md
4. написали в них текст
5. скрыли вычислительный сегмент
6. выполнили
7. поменяли местами первый и второй
8. вставили сегмент после первого
 */
test('double-md-test', async () => {
    const {
        startupService,
        projectPageService,
        rpi,
        repository,
        programEditorService,
    } = mockContext();
    mockUserInfoForUnauthorized(rpi);

    rpi.compilationRequest = jest.fn().mockResolvedValue({
        code: 200,
        body: {
            segments: [
                { type: 'empty' },
                { type: 'md', text: 'my md' } as TextOutputSegment,
            ],
        } as CompileSuccessResult,
        isOk: true,
        isUnauth: false,
        isForbidden: false,
    });

    await startupService.onAppStartup();

    programEditorService.onAddSegmentClicked('computational');
    programEditorService.onAddSegmentClicked('md');

    await programEditorService.onSegmentTextEdited(0, 'a = 10');
    await programEditorService.onSegmentTextEdited(1, 'my md');

    await programEditorService.segmentEditorChangeSegmentVisibility(
        false,
        'visible',
        0
    );

    await projectPageService.onRunButtonClicked();

    await programEditorService.segmentEditorChangeSegmentPosition('up', 1);

    matchRepositorySnapshot(repository);

    await programEditorService.onSegmentAddedViaDivider('md', 0);

    matchRepositorySnapshot(repository);
});
