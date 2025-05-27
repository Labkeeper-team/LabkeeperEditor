import { mockRpi, Rpi } from '../../model/rpi';

/*
TODO remove this
 */
jest.mock('./../../constants.ts', () => {});
jest.mock('../../main.tsx', () => {});
jest.mock('../../view/routing', () => {});

import { mockViewModelState } from '../../viewModel/viewModelState';
import { headerHelpItems } from '../../model/help';
import { Program } from '../../model/domain.ts';
import { SystemService } from '../../viewModel';
import { ProgramService } from '../../model/service/program.ts';
import { LoaderService } from '../../viewModel/project.ts';
import { StartupService } from '../../viewModel/init.ts';
import { CompilationService } from '../../viewModel/compile.ts';
import { IdeService } from '../../viewModel/ide.ts';
import { mockObserver, ObserverService } from '../../model/service/observer.ts';

const defaultParams = {
    visible: true,
    hideArray: false,
    hideGeneralFormula: false,
    hideInflAssignment: false,
    hideAssignmentWithValues: false,
    hideInflAssignmentWithValues: false,
};

const mockContext = () => {
    const repository = mockViewModelState();
    const programService: ProgramService = new ProgramService();
    const rpi: Rpi = mockRpi();
    const loaderService: LoaderService = new LoaderService(rpi, repository);
    const observerService: ObserverService = mockObserver();
    const startupService: StartupService = new StartupService(
        rpi,
        programService,
        loaderService,
        repository
    );
    const compilationService: CompilationService = new CompilationService(
        repository,
        rpi,
        programService,
        loaderService,
        observerService
    );
    const ideService: IdeService = new IdeService(repository);
    const systemService: SystemService = new SystemService(
        repository,
        rpi,
        programService,
        loaderService,
        ideService,
        startupService,
        compilationService,
        observerService
    );

    return {
        systemService,
        ideService,
        compilationService,
        startupService,
        loaderService,
        rpi,
        programService,
        repository,
    };
};

test('help-items-add-test', () => {
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

    systemService.onFocusSegment(0);
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
