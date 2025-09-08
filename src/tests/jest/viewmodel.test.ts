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

import { mockViewModelState } from '../../viewModel/viewModelState';
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
import { mockObserver, ObserverService } from '../../model/service/observer.ts';

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
    const { programService, systemService } = mockContext();

    systemService.onHelpItemCreated(headerHelpItems[0]);
    let program = programService.getCurrentProgram();
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

    systemService.onHelpItemCreated(headerHelpItems[0]);
    program = programService.getCurrentProgram();
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

    await systemService.onFocusSegment(0);
    systemService.onHelpItemCreated(headerHelpItems[0]);

    program = programService.getCurrentProgram();
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
    const { mvs, systemService } = mockContext();

    systemService.onAddSegmentClicked('md');
    systemService.onAddSegmentClicked('md');
    systemService.onAddSegmentClicked('md');
    systemService.onAddSegmentClicked('md');

    expect(mvs.ideViewModelState.activeSegmentIndex()).toBe(4);

    await systemService.onSegmentAddedViaDivider('computational', 2);

    expect(mvs.ideViewModelState.activeSegmentIndex()).toBe(3);
    expect(mvs.ideViewModelState.previousActiveSegmentIndex()).toBe(4);

    await systemService.onSegmentTextEdited(3, 'text');

    expect(
        mvs.projectViewModelState.currentProgram().segments.map((s) => s.text)
    ).toStrictEqual(['', '', '', 'text', '']);
});

test('login-and-logout-history-test', async () => {
    const { mvs, systemService, rpi } = mockContext();

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

    await systemService.onAppStartup();
    await systemService.onFormLoginClicked('a@gmail.com', 'a', 'biba');

    systemService.onAddSegmentClicked('md');
    await systemService.onSegmentTextEdited(0, 'aaa');

    rpi.logoutRequest = jest.fn().mockResolvedValue({
        code: 200,
        body: {},
        isOk: true,
        isUnauth: false,
        isForbidden: false,
    });

    await systemService.onLogoutButtonClicked();

    systemService.onAddSegmentClicked('md');

    const currentProgram = mvs.projectViewModelState.currentProgram();
    expect(currentProgram.segments.map((s) => s.text)).toStrictEqual(['']);
});

test('remove-readonly-when-project-is-create-test', async () => {
    const { mvs, systemService, rpi } = mockContext();
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

    await systemService.onAppStartup();

    await systemService.onBackButtonClicked();

    await systemService.onProjectCreate(
        'biba',
        () => {},
        () => {}
    );

    expect(mvs.projectViewModelState.projectIsReadonly()).toBe(false);
});

test('help-items-create-new-test', async () => {
    const { mvs, systemService, rpi } = mockContext();

    rpi.getUserInfoRequest = jest
        .fn()
        .mockResolvedValue(createDefaultUserInfo(false));

    const item = headerHelpItems[1];

    await systemService.onAppStartup(); // приложение запустилось
    systemService.onHelpItemCreated(item); // нажали на подсказку
    await systemService.onFocusSegment(0); // нажали на сегмент
    await systemService.deleteSegment(0); // удалили сегмент
    expect(mvs.projectViewModelState.currentProgram().segments.length).toBe(0);
    systemService.onHelpItemCreated(item); // снова нажали на подсказку
    // должен остаться один сегмент
    expect(mvs.projectViewModelState.currentProgram().segments.length).toBe(1);
});

/* функция проверяет корректность отображения нового проекта
1. Заходит в дефолтный проект
2. Заходит на страницу со всеми проектами
3. Создает новый проект
4. Возвращается обратно на страницу со всеми проектами
5. Сравнивается список проектов с предыдущим списком + новым проектом
 */
test('display-name-new-project-test', async () => {
    const { mvs, systemService, rpi } = mockContext();

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

    await systemService.onAppStartup(); // приложение запустилось
    await systemService.onBackButtonClicked(); // перейти на экран с проектами
    rpi.getAllProjectsRequest = jest.fn().mockResolvedValue({
        code: 200,
        isOk: true,
        isUnauth: false,
        isForbidden: false,
        body: {
            projects: allprojects,
        },
    } as RequestResult<ListProjectsResponse>); //запрос остальных проектов
    await systemService.onProjectCreate(
        'New Project',
        () => {},
        () => {}
    ); // создать новый проект
    await systemService.onBackButtonClicked(); // перейти на экран с проектами
    expect(mvs.projectsViewModelState.projects()).toBe(allprojects);
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
    const { mvs, fileService } = mockContext();
    const files: LabkeeperFile[] = [
        { autogenerated: true, fileName: 'file_seg5.png', url: '25' },
    ];
    mvs.projectViewModelState.setFiles(files);
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
    const { mvs, fileService } = mockContext();
    const files: LabkeeperFile[] = [
        { autogenerated: true, fileName: 'file_seg5.png', url: '25' },
        { autogenerated: true, fileName: 'file_seg5(1).png', url: '25' },
        { autogenerated: true, fileName: 'file_seg5(2).png', url: '25' },
        { autogenerated: true, fileName: 'file_seg5(3).png', url: '25' },
        { autogenerated: true, fileName: 'file_seg5(4).png', url: '25' },
    ];
    mvs.projectViewModelState.setFiles(files);
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
    const { mvs, fileService } = mockContext();
    const files: LabkeeperFile[] = [
        { autogenerated: true, fileName: 'file_seg5.png', url: '25' },
        { autogenerated: true, fileName: 'file_seg5(1).png', url: '25' },
        { autogenerated: true, fileName: 'file_seg5(7).png', url: '25' },
        { autogenerated: true, fileName: 'file_seg5(3).png', url: '25' },
    ];
    mvs.projectViewModelState.setFiles(files);
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
    const { rpi, mvs, systemService } = mockContext();

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

    await systemService.onAppStartup();

    systemService.onAddSegmentClicked('computational');
    await systemService.onSegmentTextEdited(0, 'a1 = 10');

    systemService.onAddSegmentClicked('md');
    await systemService.onSegmentTextEdited(1, 'md1');

    systemService.onAddSegmentClicked('computational');
    await systemService.onSegmentTextEdited(2, 'a2 = 10');

    await systemService.onRunButtonClicked();

    await systemService.segmentEditorChangeSegmentPosition('up', 1);

    const segments = mvs.projectViewModelState.compileSuccessResult().segments;

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
    const { rpi, mvs, systemService } = mockContext();

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

    systemService.onAddSegmentClicked('computational');
    await systemService.onSegmentTextEdited(0, 'a = 19');
    systemService.onAddSegmentClicked('md');
    await systemService.onSegmentTextEdited(1, 'biba');

    await systemService.onFocusSegment(1);
    await systemService.onBlurSegment(1, 'biba');

    systemService.onHelpItemCreated(headerHelpItems[0]);

    const segments = mvs.projectViewModelState.currentProgram().segments;
    expect(segments.map((s) => s.text)).toStrictEqual([
        'a = 19',
        'my_array = [1, 2, 3, 4]',
        'biba',
    ]);
});
