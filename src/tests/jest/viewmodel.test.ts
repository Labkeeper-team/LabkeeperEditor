import {
    ListProjectsResponse,
    mockRpi,
    RequestResult,
    RichProject,
    Rpi,
} from '../../model/rpi';

global.structuredClone = (val) => {
    return JSON.parse(JSON.stringify(val));
};

import { mockViewModelState } from '../../viewModel/repository';
import { headerHelpItems } from '../../model/help';
import {
    CompileSuccessResult,
    ComputationalOutputSegment,
    LabkeeperFile,
    Program,
    Project,
    Statement,
    TextOutputSegment,
    UserInfo,
} from '../../model/domain.ts';
import { setupContext } from '../../viewModel/context.ts';
import {
    mockObserver,
    ObserverService,
} from '../../model/service/ObserverService.ts';

const defaultParams = {
    visible: true,
};

const mockContext = () => {
    const mvs = mockViewModelState();
    const rpi: Rpi = mockRpi();
    const observerService: ObserverService = mockObserver();

    return setupContext(rpi, mvs, observerService);
};

// Создает дефолтный пустой проект
function createDefaultProject(projectId: string, title: string): RichProject {
    return {
        projectId: projectId,
        userId: 1,
        title: title,
        lastProgramResult: undefined,
        lastModified: new Date().toISOString(),
        isPublic: false,
        program: {
            segments: [],
            parameters: {
                roundStrategy: 'noRound',
            },
        },
    };
}

// Создает дефолтную информацию о юзере
function createDefaultUserInfo(
    isAuthenticated: boolean
): RequestResult<UserInfo> {
    return {
        code: 200,
        body: {
            isAuthenticated: isAuthenticated,
            email: 'a@gmail.com',
            id: 1,
        },
        isOk: true,
        isUnauth: false,
        isForbidden: false,
    };
}

test('help-items-add-test', async () => {
    const { repository, programEditorService, projectPageService } =
        mockContext();

    projectPageService.onHelpItemCreated(headerHelpItems[0]);
    let program = repository.projectViewModelRepository.currentProgram();
    expect(program).toEqual({
        parameters: {
            roundStrategy: 'firstMeaningDigit',
        },
        segments: [
            {
                parameters: defaultParams,
                text: `my_array = [1, 2, 3, 4]`,
                type: 'computational',
            },
        ],
    } as Program);

    projectPageService.onHelpItemCreated(headerHelpItems[0]);
    program = repository.projectViewModelRepository.currentProgram();
    expect(program).toEqual({
        parameters: {
            roundStrategy: 'firstMeaningDigit',
        },
        segments: [
            {
                parameters: defaultParams,
                text: `my_array = [1, 2, 3, 4]`,
                type: 'computational',
            },
            {
                parameters: defaultParams,
                text: `my_array = [1, 2, 3, 4]`,
                type: 'computational',
            },
        ],
    } as Program);

    await programEditorService.onFocusSegment(0);
    projectPageService.onHelpItemCreated(headerHelpItems[0]);

    program = repository.projectViewModelRepository.currentProgram();
    expect(program).toEqual({
        parameters: {
            roundStrategy: 'firstMeaningDigit',
        },
        segments: [
            {
                parameters: defaultParams,
                text: `my_array = [1, 2, 3, 4]\n\nmy_array = [1, 2, 3, 4]`,
                type: 'computational',
            },
            {
                parameters: defaultParams,
                text: `my_array = [1, 2, 3, 4]`,
                type: 'computational',
            },
        ],
    } as Program);
});

test('add-segment-between-active-index-test', async () => {
    const { repository, programEditorService } = mockContext();

    programEditorService.onAddSegmentClicked('md');
    programEditorService.onAddSegmentClicked('md');
    programEditorService.onAddSegmentClicked('md');
    programEditorService.onAddSegmentClicked('md');

    expect(repository.ideViewModelRepository.activeSegmentIndex()).toBe(4);

    await programEditorService.onSegmentAddedViaDivider('computational', 2);

    expect(repository.ideViewModelRepository.activeSegmentIndex()).toBe(3);
    expect(repository.ideViewModelRepository.previousActiveSegmentIndex()).toBe(
        4
    );

    await programEditorService.onSegmentTextEdited(3, 'text');

    expect(
        repository.projectViewModelRepository
            .currentProgram()
            .segments.map((s) => s.text)
    ).toStrictEqual(['', '', '', 'text', '']);
});

test('login-and-logout-history-test', async () => {
    const {
        repository,
        rpi,
        startupService,
        authService,
        programEditorService,
    } = mockContext();

    rpi.getUserInfoRequest = jest
        .fn()
        .mockResolvedValue(createDefaultUserInfo(false));
    rpi.formLoginRequest = jest.fn().mockResolvedValue({
        code: 200,
        body: {},
        isOk: true,
        isUnauth: false,
        isForbidden: false,
    });

    await startupService.onAppStartup();
    await authService.onFormLoginClicked('a@gmail.com', 'a', 'biba');

    programEditorService.onAddSegmentClicked('md');
    await programEditorService.onSegmentTextEdited(0, 'aaa');

    rpi.logoutRequest = jest.fn().mockResolvedValue({
        code: 200,
        body: {},
        isOk: true,
        isUnauth: false,
        isForbidden: false,
    });

    await authService.onLogoutButtonClicked();

    programEditorService.onAddSegmentClicked('md');

    const currentProgram =
        repository.projectViewModelRepository.currentProgram();
    expect(currentProgram.segments.map((s) => s.text)).toStrictEqual(['']);
});

test('remove-readonly-when-project-is-create-test', async () => {
    const {
        repository,
        rpi,
        startupService,
        projectPageService,
        projectsPageService,
    } = mockContext();
    const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

    rpi.getUserInfoRequest = jest
        .fn()
        .mockResolvedValue(createDefaultUserInfo(true));
    rpi.getDefaultProjectRequest = jest.fn().mockResolvedValue({
        code: 200,
        isOk: true,
        isUnauth: false,
        isForbidden: false,
        body: createDefaultProject(uuid, 'Default Project'),
    } as RequestResult<RichProject>);
    rpi.getAllProjectsRequest = jest.fn().mockResolvedValue({
        code: 200,
        isOk: true,
        isUnauth: false,
        isForbidden: false,
        body: {
            projects: [],
        },
    } as RequestResult<ListProjectsResponse>);
    rpi.createProjectRequest = jest.fn().mockResolvedValue({
        code: 200,
        isOk: true,
        isUnauth: false,
        isForbidden: false,
        body: createDefaultProject(uuid, 'Default Project2'),
    } as RequestResult<Project>);

    await startupService.onAppStartup();

    await projectPageService.onBackButtonClicked();

    await projectsPageService.onProjectCreate(
        'biba',
        () => {},
        () => {}
    );

    expect(repository.projectViewModelRepository.projectIsReadonly()).toBe(
        false
    );
});

test('help-items-create-new-test', async () => {
    const {
        repository,
        rpi,
        startupService,
        projectPageService,
        programEditorService,
    } = mockContext();

    rpi.getUserInfoRequest = jest
        .fn()
        .mockResolvedValue(createDefaultUserInfo(false));

    const item = headerHelpItems[1];

    await startupService.onAppStartup(); // приложение запустилось
    projectPageService.onHelpItemCreated(item); // нажали на подсказку
    await programEditorService.onFocusSegment(0); // нажали на сегмент
    await programEditorService.deleteSegment(0); // удалили сегмент
    expect(
        repository.projectViewModelRepository.currentProgram().segments.length
    ).toBe(0);
    projectPageService.onHelpItemCreated(item); // снова нажали на подсказку
    // должен остаться один сегмент
    expect(
        repository.projectViewModelRepository.currentProgram().segments.length
    ).toBe(1);
});

/* функция проверяет корректность отображения нового проекта
1. Заходит в дефолтный проект
2. Заходит на страницу со всеми проектами
3. Создает новый проект
4. Возвращается обратно на страницу со всеми проектами
5. Сравнивается список проектов с предыдущим списком + новым проектом
 */
test('display-name-new-project-test', async () => {
    const {
        repository,
        rpi,
        startupService,
        projectPageService,
        projectsPageService,
    } = mockContext();

    rpi.getUserInfoRequest = jest
        .fn()
        .mockResolvedValue(createDefaultUserInfo(true)); // залогиниться

    rpi.getDefaultProjectRequest = jest.fn().mockResolvedValue({
        code: 200,
        isOk: true,
        isUnauth: false,
        isForbidden: false,
        body: createDefaultProject(
            '2ce18705-6c4f-48cb-96f1-9a923931f8cd',
            'Last Project'
        ),
    } as RequestResult<RichProject>); //запрос дефолтного проекта

    const alloldprojects = [
        createDefaultProject(
            '2ce18705-6c4f-48cb-96f1-9a923931f8cd',
            'Last Project'
        ),
        createDefaultProject(
            '2ae18705-6c5f-48cb-96f1-9a923931f0cd',
            'First Project'
        ),
        createDefaultProject(
            '2cd18705-7c4f-48cb-90f1-9a923931f8cd',
            'Second Project'
        ),
    ];

    const allprojects = [
        ...alloldprojects,
        createDefaultProject(
            '2ce18705-5c4f-45cb-96f1-9a953951f5ed',
            'New Project'
        ),
    ];

    rpi.getAllProjectsRequest = jest.fn().mockResolvedValue({
        code: 200,
        isOk: true,
        isUnauth: false,
        isForbidden: false,
        body: {
            projects: alloldprojects,
        },
    } as RequestResult<ListProjectsResponse>); //запрос остальных проектов

    rpi.createProjectRequest = jest.fn().mockResolvedValue({
        code: 200,
        isOk: true,
        isUnauth: false,
        isForbidden: false,
        body: createDefaultProject(
            '2ce18705-5c4f-45cb-96f1-9a953951f5ed',
            'New Project'
        ),
    } as RequestResult<Project>); // создание нового проекта

    await startupService.onAppStartup(); // приложение запустилось
    await projectPageService.onBackButtonClicked(); // перейти на экран с проектами
    rpi.getAllProjectsRequest = jest.fn().mockResolvedValue({
        code: 200,
        isOk: true,
        isUnauth: false,
        isForbidden: false,
        body: {
            projects: allprojects,
        },
    } as RequestResult<ListProjectsResponse>); //запрос остальных проектов
    await projectsPageService.onProjectCreate(
        'New Project',
        () => {},
        () => {}
    ); // создать новый проект
    await projectPageService.onBackButtonClicked(); // перейти на экран с проектами
    expect(repository.projectsViewModelRepository.projects()).toBe(allprojects);
});

/*
Тест на проверку создания 1 файла в сегменте через Ctrl+V(не имеющий до этого схожего названия)
Сценарий:
1. Новый файл вставленный через Ctr+V должен быть назван file_segm${segment_id}.png,
 */
test('add-new-file-via-CtrV-test_1', () => {
    const { fileService } = mockContext();
    const segment_id = 3;
    expect(fileService.calculateNumberFile(segment_id, 'vghvgvh.png')).toBe(
        'file_seg3.png'
    );
});

/*
Тест на проверку создания еще 1 файла в том же сегменте через Ctrl+V
Сценарий:
1. У пользователя в сегменте под номером ${segment_id} уже есть 1 файл, названный по правилам
вставки file_segm${segment_id}.png
2. Новый файл вставленный через Ctr+V должен быть назван также, но следующей
версией file_segm${segment_id}(1).png
 */
test('add-new-file-via-CtrV-test_2', () => {
    const { repository, fileService } = mockContext();
    const files: LabkeeperFile[] = [
        { autogenerated: true, fileName: 'file_seg5.png', url: '25' },
    ];
    repository.projectViewModelRepository.setFiles(files);
    const segment_id = 5;
    expect(fileService.calculateNumberFile(segment_id, 'vghvgvh.png')).toBe(
        'file_seg5(1).png'
    );
});

/*
Тест на проверку создания еще 1 файла в том же сегменте через Ctrl+V
Сценарий:
1. У пользователя в сегменте под номером ${segment_id} уже есть 5 файлв, названных по правилам
вставки file_segm${segment_id}.png, file_segm${segment_id}(1).png, ... file_segm${segment_id}(4).png
2. Новый файл вставленный через Ctr+V должен быть назван также, но следующей
версией file_segm${segment_id}(5).png
 */
test('add-new-file-via-CtrV-test_3', () => {
    const { repository, fileService } = mockContext();
    const files: LabkeeperFile[] = [
        { autogenerated: true, fileName: 'file_seg5.png', url: '25' },
        { autogenerated: true, fileName: 'file_seg5(1).png', url: '25' },
        { autogenerated: true, fileName: 'file_seg5(2).png', url: '25' },
        { autogenerated: true, fileName: 'file_seg5(3).png', url: '25' },
        { autogenerated: true, fileName: 'file_seg5(4).png', url: '25' },
    ];
    repository.projectViewModelRepository.setFiles(files);
    const segment_id = 5;
    expect(fileService.calculateNumberFile(segment_id, 'vgh87ygvh.png')).toBe(
        'file_seg5(5).png'
    );
});

/*
Тест на проверку создания еще 1 файла в том же сегменте через Ctrl+V
Сценарий:
1. У пользователя в сегменте под номером ${segment_id} уже есть 4 файлa, названных по правилам
вставки file_segm${segment_id}(i).png, но i это не {0, ... 3}
2. Новый файл вставленный через Ctr+V должен быть назван с использованием ближайшего к нулю целого числа,
 не использованного до этого
Пример: имеем file_segm${segment_id}.png, file_segm${segment_id}(1).png, file_segm${segment_id}(3).png,
file_segm${segment_id}(7).png
Вывод: file_segm${segment_id}(2).png
 */
test('add-new-file-via-CtrV-test_4', () => {
    const { repository, fileService } = mockContext();
    const files: LabkeeperFile[] = [
        { autogenerated: true, fileName: 'file_seg5.png', url: '25' },
        { autogenerated: true, fileName: 'file_seg5(1).png', url: '25' },
        { autogenerated: true, fileName: 'file_seg5(7).png', url: '25' },
        { autogenerated: true, fileName: 'file_seg5(3).png', url: '25' },
    ];
    repository.projectViewModelRepository.setFiles(files);
    const segment_id = 5;
    expect(fileService.calculateNumberFile(segment_id, 'vgh87ygvh.png')).toBe(
        'file_seg5(2).png'
    );
});

/*
Тест на то, не продублируется ли маркдаун при нажатии на стрелку смещения сегмента.
Сценарий:
1. Юзер не залогинен
2. создаем три сегмента (comp, md, comp)
3. заполняем сегменты текстом
4. компилируем
5. двигаем второй сегмент наверх (comp, md, comp) -> (md, comp, comp)
6. результат компиляции для первого вычислительного сегмента должен быть не определен
 */
test('segments-move-with-result-test', async () => {
    const {
        rpi,
        repository,
        programEditorService,
        projectPageService,
        startupService,
    } = mockContext();

    rpi.getUserInfoRequest = jest.fn().mockResolvedValue({
        code: 200,
        body: {
            isAuthenticated: false,
            email: 'a@gmail.com',
            id: 1,
        },
        isOk: true,
        isUnauth: false,
        isForbidden: false,
    } as RequestResult<UserInfo>);

    rpi.compilationRequest = jest.fn().mockResolvedValue({
        code: 200,
        body: {
            segments: [
                {
                    type: 'computational',
                    statements: [
                        {
                            type: 'latex',
                            latex: 'a1 = 10',
                        } as Statement,
                    ],
                } as ComputationalOutputSegment,
                {
                    type: 'md',
                    text: 'md1',
                } as TextOutputSegment,
                {
                    type: 'computational',
                    statements: [
                        {
                            type: 'latex',
                            latex: 'a2 = 10',
                        } as Statement,
                    ],
                } as ComputationalOutputSegment,
            ],
        } as CompileSuccessResult,
        isOk: true,
        isUnauth: false,
        isForbidden: false,
    } as RequestResult<CompileSuccessResult>);

    await startupService.onAppStartup();

    programEditorService.onAddSegmentClicked('computational');
    await programEditorService.onSegmentTextEdited(0, 'a1 = 10');

    programEditorService.onAddSegmentClicked('md');
    await programEditorService.onSegmentTextEdited(1, 'md1');

    programEditorService.onAddSegmentClicked('computational');
    await programEditorService.onSegmentTextEdited(2, 'a2 = 10');

    await projectPageService.onRunButtonClicked();

    await programEditorService.segmentEditorChangeSegmentPosition('up', 1);

    const segments =
        repository.projectViewModelRepository.compileSuccessResult().segments;

    expect(segments).toStrictEqual([
        {
            type: 'md',
            text: 'md1',
        } as TextOutputSegment,
        {
            type: 'computational',
            statements: [
                {
                    type: 'no_result',
                } as Statement,
            ],
        } as ComputationalOutputSegment,
        {
            type: 'computational',
            statements: [
                {
                    type: 'latex',
                    latex: 'a2 = 10',
                } as Statement,
            ],
        } as ComputationalOutputSegment,
    ]);
});

/*
https://github.com/Labkeeper-team/TypeThree/issues/303
Тест про то, как подсказки перезатирают сегменты.
Сценарий:
1. создаем выч сегмент
2. пишем в него текст
3. создаем md сегмент
4. пишем в него текст
5. выделяем последний сегмент
6. отменяем выделение последнего сегмента
7. добавляем подсказку
8. проверяем, что все ок
 */
test('hint-erase-other-segments-test', async () => {
    const { rpi, repository, programEditorService, projectPageService } =
        mockContext();

    rpi.getUserInfoRequest = jest.fn().mockResolvedValue({
        code: 200,
        body: {
            isAuthenticated: false,
            email: 'a@gmail.com',
            id: 1,
        },
        isOk: true,
        isUnauth: false,
        isForbidden: false,
    } as RequestResult<UserInfo>);

    programEditorService.onAddSegmentClicked('computational');
    await programEditorService.onSegmentTextEdited(0, 'a = 19');
    programEditorService.onAddSegmentClicked('md');
    await programEditorService.onSegmentTextEdited(1, 'biba');

    await programEditorService.onFocusSegment(1);
    await programEditorService.onBlurSegment(1, 'biba');

    projectPageService.onHelpItemCreated(headerHelpItems[0]);

    const segments =
        repository.projectViewModelRepository.currentProgram().segments;
    expect(segments.map((s) => s.text)).toStrictEqual([
        'a = 19',
        'my_array = [1, 2, 3, 4]',
        'biba',
    ]);
});
