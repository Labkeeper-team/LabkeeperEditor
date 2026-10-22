import {
    readAgentCheckpointBase,
    writeAgentCheckpointBase,
} from '../../../view/store/agentCheckpointBases.ts';

const BASE = { entryId: 'e1', createdAt: '2026-10-21T10:00:00Z' };

beforeEach(() => window.localStorage.clear());

// находка разбора: граница в срезе redux-persist затиралась второй вкладкой
test('base-lives-in-its-own-key-and-other-projects-survive', () => {
    writeAgentCheckpointBase('p1', BASE);
    // вторая вкладка пишет границу своего проекта
    writeAgentCheckpointBase('p2', { entryId: null, createdAt: null });

    expect(readAgentCheckpointBase('p1')).toEqual(BASE);
    expect(readAgentCheckpointBase('p2')).toEqual({
        entryId: null,
        createdAt: null,
    });
    expect(
        Object.keys(window.localStorage).filter((key) =>
            key.startsWith('persist:')
        )
    ).toEqual([]);
});

test('undefined-forgets-the-base', () => {
    writeAgentCheckpointBase('p1', BASE);
    writeAgentCheckpointBase('p1', undefined);

    expect(readAgentCheckpointBase('p1')).toBeUndefined();
});

test('oldest-projects-are-evicted-after-fifty', () => {
    for (let i = 0; i < 51; i++) {
        writeAgentCheckpointBase(`p${i}`, BASE);
    }

    expect(readAgentCheckpointBase('p0')).toBeUndefined();
    expect(readAgentCheckpointBase('p1')).toEqual(BASE);
    expect(readAgentCheckpointBase('p50')).toEqual(BASE);
});

test('broken-storage-gives-no-base', () => {
    window.localStorage.setItem(
        'labkeeper.agentCheckpointBases',
        JSON.stringify({ p1: { entryId: 5 }, p2: BASE })
    );
    expect(readAgentCheckpointBase('p1')).toBeUndefined();
    expect(readAgentCheckpointBase('p2')).toEqual(BASE);

    window.localStorage.setItem('labkeeper.agentCheckpointBases', '{');
    expect(readAgentCheckpointBase('p2')).toBeUndefined();
});
