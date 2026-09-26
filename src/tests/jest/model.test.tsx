import { ProgramService } from '../../model/service/ProgramService.ts';
import { Program, Segment } from '../../model/domain.ts';
import { InMemoryProgramRepository } from '../../model/repository/ProgramRepository.ts';

global.structuredClone = (val) => {
    if (val === undefined) {
        return undefined;
    }
    return JSON.parse(JSON.stringify(val));
};

test('program-service-test', () => {
    const service: ProgramService = new ProgramService(
        new InMemoryProgramRepository()
    );

    service.addSegmentToLastPosition('md');
    service.changeSegmentTextByPositionIndex(0, 'biba');

    expect(service.getCurrentProgram().segments).toStrictEqual([
        {
            id: 1,
            type: 'md',
            text: 'biba',
            parameters: { visible: true },
        },
    ] as Segment[]);

    service.changeSegmentTextByPositionIndex(0, 'biba1');

    expect(service.getCurrentProgram().segments).toStrictEqual([
        {
            id: 1,
            type: 'md',
            text: 'biba1',
            parameters: { visible: true },
        },
    ] as Segment[]);

    service.addSegmentToLastPosition('computational');

    expect(service.getCurrentProgram().segments).toStrictEqual([
        {
            id: 1,
            type: 'md',
            text: 'biba1',
            parameters: { visible: true },
        },
        {
            id: 2,
            type: 'computational',
            text: '',
            parameters: { visible: true },
        },
    ] as Segment[]);

    service.changeSegmentTextByPositionIndex(1, 'boba');

    expect(service.getCurrentProgram().segments).toStrictEqual([
        {
            id: 1,
            type: 'md',
            text: 'biba1',
            parameters: { visible: true },
        },
        {
            id: 2,
            type: 'computational',
            text: 'boba',
            parameters: { visible: true },
        },
    ] as Segment[]);

    service.addSegmentAfterIndex('asciimath', 0);

    expect(service.getCurrentProgram().segments).toStrictEqual([
        {
            id: 1,
            type: 'md',
            text: 'biba1',
            parameters: { visible: true },
        },
        {
            id: 2,
            type: 'asciimath',
            text: '',
            parameters: { visible: true },
        },
        {
            id: 3,
            type: 'computational',
            text: 'boba',
            parameters: { visible: true },
        },
    ] as Segment[]);

    service.undo();
    service.undo();

    expect(service.getCurrentProgram().segments).toStrictEqual([
        {
            id: 1,
            type: 'md',
            text: 'biba1',
            parameters: { visible: true },
        },
        {
            id: 2,
            type: 'computational',
            text: '',
            parameters: { visible: true },
        },
    ] as Segment[]);

    service.redo();

    expect(service.getCurrentProgram().segments).toStrictEqual([
        {
            id: 1,
            type: 'md',
            text: 'biba1',
            parameters: { visible: true },
        },
        {
            id: 2,
            type: 'computational',
            text: 'boba',
            parameters: { visible: true },
        },
    ] as Segment[]);

    service.changeSegmentTextByPositionIndex(0, 'biba2');

    expect(service.getCurrentProgram().segments).toStrictEqual([
        {
            id: 1,
            type: 'md',
            text: 'biba2',
            parameters: { visible: true },
        },
        {
            id: 2,
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
            id: 1,
            type: 'md',
            text: 'biba2',
            parameters: { visible: true },
        },
        {
            id: 2,
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
            id: 1,
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
            id: 1,
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

function serviceWithSegments(...texts: string[]): ProgramService {
    const service = new ProgramService(new InMemoryProgramRepository());
    service.setNewProgram({
        segments: texts.map((text) => ({
            type: 'md',
            text,
            parameters: { visible: true },
        })),
        parameters: { roundStrategy: 'noRound' },
    });
    return service;
}

const segmentTexts = (service: ProgramService) =>
    service.getCurrentProgram().segments.map((segment) => segment.text);

// редактор сохраняет программу после каждого undo и redo, а сохранение ставит границу шага
test('redo-walks-whole-history-when-save-puts-gaps-test', () => {
    const service = serviceWithSegments('');
    for (const text of ['a', 'ab', 'abc']) {
        service.changeSegmentTextByPositionIndex(0, text);
        service.gap();
    }
    for (let i = 0; i < 3; i++) {
        service.undo();
        service.gap();
    }
    expect(segmentTexts(service)).toEqual(['']);

    const redone: string[] = [];
    for (let i = 0; i < 3; i++) {
        service.redo();
        service.gap();
        redone.push(segmentTexts(service)[0]);
    }

    expect(redone).toEqual(['a', 'ab', 'abc']);
    expect(service.canRedo()).toBe(false);
});

// правки в двух сегментах быстрее таймера сохранения получают одну границу на двоих
test('redo-survives-gap-after-undo-of-adjacent-edits-test', () => {
    const service = serviceWithSegments('A', 'B');
    service.changeSegmentTextByPositionIndex(0, 'Ax');
    service.changeSegmentTextByPositionIndex(1, 'By');
    service.gap();
    for (let i = 0; i < 2; i++) {
        service.undo();
        service.gap();
    }
    expect(segmentTexts(service)).toEqual(['A', 'B']);

    for (let i = 0; i < 2; i++) {
        service.redo();
        service.gap();
    }

    expect(segmentTexts(service)).toEqual(['Ax', 'By']);
});

// лимит истории считает и границы, лишняя граница на каждом круге вытеснила бы старые шаги
test('undo-redo-cycles-keep-history-depth-test', () => {
    const service = serviceWithSegments('');
    const steps = 20;
    let text = '';
    for (let i = 0; i < steps; i++) {
        text += `${i % 10}`;
        service.changeSegmentTextByPositionIndex(0, text);
        service.gap();
    }
    for (let cycle = 0; cycle < 3; cycle++) {
        for (let i = 0; i < steps; i++) {
            service.undo();
            service.gap();
        }
        for (let i = 0; i < steps; i++) {
            service.redo();
            service.gap();
        }
    }
    expect(segmentTexts(service)).toEqual([text]);

    for (let i = 0; i < steps; i++) {
        service.undo();
        service.gap();
    }

    expect(segmentTexts(service)).toEqual(['']);
});

// сохранение после undo ещё в сети, а человек уже печатает, и правка сливается с прошлой
test('typing-over-undone-step-before-gap-clears-redo-test', () => {
    const service = serviceWithSegments('A', 'B');
    service.changeSegmentTextByPositionIndex(0, 'Ax');
    service.changeSegmentTextByPositionIndex(1, 'By');
    service.undo();
    expect(service.canRedo()).toBe(true);

    service.changeSegmentTextByPositionIndex(0, 'Axz');

    expect(service.canRedo()).toBe(false);
});

// редактор присылает обратно тот же текст, это не правка
test('echo-of-same-text-keeps-redo-test', () => {
    const service = serviceWithSegments('A', 'B');
    service.changeSegmentTextByPositionIndex(0, 'Ax');
    service.changeSegmentTextByPositionIndex(1, 'By');
    service.undo();

    service.changeSegmentTextByPositionIndex(0, 'Ax');

    expect(service.canRedo()).toBe(true);
    service.redo();
    expect(segmentTexts(service)).toEqual(['Ax', 'By']);
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
            id: 1,
            type: 'md',
            text: 'aaaa\nbbbbb\ncccc1111\n',
            parameters: { visible: true },
        },
    ] as Segment[]);

    service.undo();

    expect(service.getCurrentProgram().segments).toStrictEqual([
        {
            id: 1,
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
            id: 1,
            type: 'md',
            text: 'aaa0',
            parameters: { visible: true },
        },
        {
            id: 2,
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
            {
                id: 1,
                type: 'md',
                text: '',
                parameters: { visible: true },
            } as Segment,
        ],
        parameters: { roundStrategy: 'threeDigits' },
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
            {
                id: 1,
                type: 'md',
                text: '',
                parameters: { visible: true },
            } as Segment,
        ],
        parameters: { roundStrategy: 'threeDigits' },
    } as Program);
});

test('replace-program-undo-redo-test', () => {
    const service: ProgramService = new ProgramService(
        new InMemoryProgramRepository()
    );

    service.addSegmentToLastPosition('md');
    service.changeSegmentTextByPositionIndex(0, 'biba');
    service.addSegmentToLastPosition('latex');
    service.changeSegmentTextByPositionIndex(1, 'boba');

    service.replaceWithNewProgram({
        segments: [
            {
                type: 'md',
                text: 'biba',
                parameters: { visible: true },
            },
        ],
        parameters: { roundStrategy: 'threeDigits' },
    });

    expect(service.getCurrentProgram()).toStrictEqual({
        segments: [
            {
                id: 1,
                type: 'md',
                text: 'biba',
                parameters: { visible: true },
            } as Segment,
        ],
        parameters: { roundStrategy: 'threeDigits' },
    } as Program);

    service.undo();

    expect(service.getCurrentProgram()).toStrictEqual({
        segments: [
            {
                id: 1,
                type: 'md',
                text: 'biba',
                parameters: { visible: true },
            } as Segment,
            {
                id: 2,
                type: 'latex',
                text: 'boba',
                parameters: { visible: true },
            } as Segment,
        ],
        parameters: { roundStrategy: 'threeDigits' },
    } as Program);
});

test('insert-between-segments-renumbers-ids', () => {
    const service: ProgramService = new ProgramService(
        new InMemoryProgramRepository()
    );

    service.addSegmentToLastPosition('md');
    service.changeSegmentTextByPositionIndex(0, 'first');
    service.addSegmentToLastPosition('md');
    service.changeSegmentTextByPositionIndex(1, 'second');

    service.addSegmentAfterIndex('md', 0);

    expect(service.getCurrentProgram().segments.map((s) => s.id)).toEqual([
        1, 2, 3,
    ]);
});
