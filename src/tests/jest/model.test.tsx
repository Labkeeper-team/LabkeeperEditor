import { ProgramService } from '../../model/service/ProgramService.ts';
import { Program, Segment } from '../../model/domain.ts';
import { InMemoryProgramRepository } from '../../model/repository/ProgramRepository.ts';

test('program-service-test', () => {
    const service: ProgramService = new ProgramService(
        new InMemoryProgramRepository()
    );

    service.addSegmentToLastPosition('md');
    service.changeSegmentTextByPositionIndex(0, 'biba');

    expect(service.getCurrentProgram().segments).toStrictEqual([
        {
            type: 'md',
            text: 'biba',
            parameters: { visible: true },
        },
    ] as Segment[]);

    service.changeSegmentTextByPositionIndex(0, 'biba1');

    expect(service.getCurrentProgram().segments).toStrictEqual([
        {
            type: 'md',
            text: 'biba1',
            parameters: { visible: true },
        },
    ] as Segment[]);

    service.addSegmentToLastPosition('computational');

    expect(service.getCurrentProgram().segments).toStrictEqual([
        {
            type: 'md',
            text: 'biba1',
            parameters: { visible: true },
        },
        {
            type: 'computational',
            text: '',
            parameters: { visible: true },
        },
    ] as Segment[]);

    service.changeSegmentTextByPositionIndex(1, 'boba');

    expect(service.getCurrentProgram().segments).toStrictEqual([
        {
            type: 'md',
            text: 'biba1',
            parameters: { visible: true },
        },
        {
            type: 'computational',
            text: 'boba',
            parameters: { visible: true },
        },
    ] as Segment[]);

    service.addSegmentAfterIndex('asciimath', 0);

    expect(service.getCurrentProgram().segments).toStrictEqual([
        {
            type: 'md',
            text: 'biba1',
            parameters: { visible: true },
        },
        {
            type: 'asciimath',
            text: '',
            parameters: { visible: true },
        },
        {
            type: 'computational',
            text: 'boba',
            parameters: { visible: true },
        },
    ] as Segment[]);

    service.undo();
    service.undo();

    expect(service.getCurrentProgram().segments).toStrictEqual([
        {
            type: 'md',
            text: 'biba1',
            parameters: { visible: true },
        },
        {
            type: 'computational',
            text: '',
            parameters: { visible: true },
        },
    ] as Segment[]);

    service.redo();

    expect(service.getCurrentProgram().segments).toStrictEqual([
        {
            type: 'md',
            text: 'biba1',
            parameters: { visible: true },
        },
        {
            type: 'computational',
            text: 'boba',
            parameters: { visible: true },
        },
    ] as Segment[]);

    service.changeSegmentTextByPositionIndex(0, 'biba2');

    expect(service.getCurrentProgram().segments).toStrictEqual([
        {
            type: 'md',
            text: 'biba2',
            parameters: { visible: true },
        },
        {
            type: 'computational',
            text: 'boba',
            parameters: { visible: true },
        },
    ] as Segment[]);

    service.redo();
    service.redo();
    service.redo();

    expect(service.getCurrentProgram().segments).toStrictEqual([
        {
            type: 'md',
            text: 'biba2',
            parameters: { visible: true },
        },
        {
            type: 'computational',
            text: 'boba',
            parameters: { visible: true },
        },
    ] as Segment[]);
});

test('gaps-test', () => {
    const service: ProgramService = new ProgramService(
        new InMemoryProgramRepository()
    );

    service.addSegmentToLastPosition('md');
    service.changeSegmentTextByPositionIndex(0, 'biba');
    service.gap();
    service.gap();
    service.gap();
    service.changeSegmentTextByPositionIndex(0, 'bibaboba');
    service.undo();

    expect(service.getCurrentProgram().segments).toStrictEqual([
        {
            type: 'md',
            text: 'biba',
            parameters: { visible: true },
        },
    ] as Segment[]);

    service.gap();
    service.redo();
    service.gap();

    expect(service.getCurrentProgram().segments).toStrictEqual([
        {
            type: 'md',
            text: 'bibaboba',
            parameters: { visible: true },
        },
    ] as Segment[]);
});

test('redo-enabled-test', () => {
    const service: ProgramService = new ProgramService(
        new InMemoryProgramRepository()
    );

    service.addSegmentToLastPosition('md');
    service.changeSegmentTextByPositionIndex(0, 'aaa');
    service.gap();
    service.undo();
    expect(service.canRedo()).toBe(true);
    service.redo();

    expect(service.canRedo()).toBe(false);
});

test('auto-gaps-test', () => {
    const service: ProgramService = new ProgramService(
        new InMemoryProgramRepository()
    );

    service.addSegmentToLastPosition('md');
    service.changeSegmentTextByPositionIndex(0, 'aaaa\nbbbbb\ncccc\n');
    service.gap();
    service.changeSegmentTextByPositionIndex(0, 'aaaa\nbbbbb\ncccc1111\n');
    service.changeSegmentTextByPositionIndex(0, 'aaaa\nbbbbb2222\ncccc\n');
    service.undo();

    expect(service.getCurrentProgram().segments).toStrictEqual([
        {
            type: 'md',
            text: 'aaaa\nbbbbb\ncccc1111\n',
            parameters: { visible: true },
        },
    ] as Segment[]);

    service.undo();

    expect(service.getCurrentProgram().segments).toStrictEqual([
        {
            type: 'md',
            text: 'aaaa\nbbbbb\ncccc\n',
            parameters: { visible: true },
        },
    ] as Segment[]);
});

test('limit-history-test', () => {
    const service: ProgramService = new ProgramService(
        new InMemoryProgramRepository()
    );

    for (let i = 0; i < 27; i++) {
        service.addSegmentToLastPosition('md');
        service.changeSegmentTextByPositionIndex(i, 'aaa' + i);
    }

    for (let i = 0; i < 150; i++) {
        service.undo();
    }

    expect(service.getCurrentProgram().segments).toStrictEqual([
        {
            type: 'md',
            text: 'aaa0',
            parameters: { visible: true },
        },
        {
            type: 'md',
            text: 'aaa1',
            parameters: { visible: true },
        },
    ] as Segment[]);
});

test('no-duplicate-text-changes-test', () => {
    const service: ProgramService = new ProgramService(
        new InMemoryProgramRepository()
    );

    service.addSegmentToLastPosition('md');
    service.changeSegmentTextByPositionIndex(0, 'abl');
    service.changeSegmentTextByPositionIndex(0, 'abl');

    service.undo();

    expect(service.getCurrentProgram()).toStrictEqual({
        segments: [
            { type: 'md', text: '', parameters: { visible: true } } as Segment,
        ],
        parameters: { roundStrategy: 'firstMeaningDigit' },
    } as Program);
});

test('unite-changes-test', () => {
    const service: ProgramService = new ProgramService(
        new InMemoryProgramRepository()
    );

    service.addSegmentToLastPosition('md');
    service.changeSegmentTextByPositionIndex(0, 'abl');
    service.changeSegmentTextByPositionIndex(0, 'abl2');
    service.changeSegmentTextByPositionIndex(0, 'abl22');
    service.changeSegmentTextByPositionIndex(0, 'abl222');

    service.undo();

    expect(service.getCurrentProgram()).toStrictEqual({
        segments: [
            { type: 'md', text: '', parameters: { visible: true } } as Segment,
        ],
        parameters: { roundStrategy: 'firstMeaningDigit' },
    } as Program);
});
