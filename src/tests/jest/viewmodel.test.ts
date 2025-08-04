import {
    ListProjectsResponse,
    mockRpi,
    RequestResult,
    RichProject,
    Rpi,
} from '../../model/rpi';

/*
TODO remove this
 */
jest.mock('./../../constants.ts', () => {});
jest.mock('../../main.tsx', () => {});
jest.mock('../../view/routing', () => {});

import { mockViewModelState } from '../../viewModel/viewModelState';
import { headerHelpItems } from '../../model/help';
import { LabkeeperFile, Program, Project } from '../../model/domain.ts';
import { setupContext } from '../../viewModel/context.ts';
import { mockObserver, ObserverService } from '../../model/service/observer.ts';
import { UserInfo } from '../../viewModel/store/slices/user';

const defaultParams = {
    visible: true,
    hideArray: false,
    hideGeneralFormula: false,
    hideInflAssignment: false,
    hideAssignmentWithValues: false,
    hideInflAssignmentWithValues: false,
};

const mockContext = () => {
    const mvs = mockViewModelState();
    const rpi: Rpi = mockRpi();
    const observerService: ObserverService = mockObserver();

    return setupContext(rpi, mvs, observerService);
};

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
                id: 1,
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
                id: 1,
            },
            {
                parameters: defaultParams,
                text: `my_array = [1, 2, 3, 4]`,
                type: 'computational',
                id: 2,
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
                id: 1,
            },
            {
                parameters: defaultParams,
                text: `my_array = [1, 2, 3, 4]`,
                type: 'computational',
                id: 2,
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

    await systemService.onSegmentAddedViaDivider(
        {
            text: 'text',
            type: 'computational',
            id: -1,
            parameters: {
                visible: true,
            },
        },
        2
    );

    expect(mvs.ideViewModelState.activeSegmentIndex()).toBe(3);
    expect(mvs.ideViewModelState.previousActiveSegmentIndex()).toBe(4);

    expect(
        mvs.projectViewModelState.currentProgram().segments.map((s) => s.text)
    ).toStrictEqual(['', '', '', 'text', '']);
});

test('login-and-logout-history-test', async () => {
    const { mvs, systemService, rpi } = mockContext();

    rpi.getUserInfoRequest = jest.fn().mockResolvedValue({
        code: 200,
        body: {
            isAuthenticated: false,
        },
        isOk: true,
        isUnauth: false,
        isForbidden: false,
    });
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

    rpi.getUserInfoRequest = jest.fn().mockResolvedValue({
        code: 200,
        body: {
            isAuthenticated: true,
            email: 'a@gmail.com',
            id: 1,
        },
        isOk: true,
        isUnauth: false,
        isForbidden: false,
    } as RequestResult<UserInfo>);
    rpi.getDefaultProjectRequest = jest.fn().mockResolvedValue({
        code: 200,
        isOk: true,
        isUnauth: false,
        isForbidden: false,
        body: {
            projectId: uuid,
            userId: 1,
            title: 'Default Project',
            lastModified: new Date().toISOString(),
            isPublic: false,
            lastProgramResult: undefined,
            program: {
                segments: [],
                parameters: {
                    roundStrategy: 'noRound',
                },
            },
        },
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
        body: {
            projectId: uuid,
            userId: 1,
            title: 'Default Project2',
            lastModified: new Date().toISOString(),
            isPublic: false,
            program: {
                segments: [],
                parameters: {
                    roundStrategy: 'noRound',
                },
            },
        },
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
