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
import { setupContext } from '../../viewModel/context.ts';
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
    const mvs = mockViewModelState();
    const rpi: Rpi = mockRpi();
    const observerService: ObserverService = mockObserver();

    return setupContext(rpi, mvs, observerService);
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

test('add-segment-between-active-index-test', () => {
    const { mvs, systemService } = mockContext();

    systemService.onAddSegmentClicked('md');
    systemService.onAddSegmentClicked('md');
    systemService.onAddSegmentClicked('md');
    systemService.onAddSegmentClicked('md');

    expect(mvs.ideViewModelState.activeSegmentIndex()).toBe(4);

    systemService.onSegmentAddedViaDivider(
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
