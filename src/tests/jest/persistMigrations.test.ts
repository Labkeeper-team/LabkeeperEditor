import type { PersistedState } from 'redux-persist';
import {
    PERSISTENCE_VERSION,
    migratePersistence,
    resetAgentSettings,
} from '../../view/store/persistMigrations.ts';

/** Так срез лежал в localStorage до версии 1: redux-persist сам ставит -1, когда version не задан */
const OLD_PERSIST = { version: -1, rehydrated: true };

const oldSlice = (fields: Record<string, unknown>) =>
    ({ ...fields, _persist: OLD_PERSIST }) as unknown as PersistedState;

const agentSettingsOf = (state: PersistedState) => {
    const slice = state as unknown as Record<string, unknown>;
    return {
        agentMaxTokens: slice.agentMaxTokens,
        agentIterations: slice.agentIterations,
    };
};

test('persistence-migration-replaces-old-defaults', () => {
    const migrated = resetAgentSettings(
        oldSlice({ agentMaxTokens: 10000, agentIterations: 5 })
    );

    expect(agentSettingsOf(migrated)).toEqual({
        agentMaxTokens: 100000,
        agentIterations: 20,
    });
});

test('persistence-migration-replaces-values-chosen-by-hand', () => {
    // значение по умолчанию, которое не трогали, в хранилище не отличить от выбранного
    const migrated = resetAgentSettings(
        oldSlice({ agentMaxTokens: 30000, agentIterations: 12 })
    );

    expect(agentSettingsOf(migrated)).toEqual({
        agentMaxTokens: 100000,
        agentIterations: 20,
    });
});

test('persistence-migration-fills-an-empty-slice', () => {
    const migrated = resetAgentSettings(oldSlice({}));

    expect(migrated).toEqual({
        _persist: OLD_PERSIST,
        agentMaxTokens: 100000,
        agentIterations: 20,
    });
});

test('persistence-migration-fills-missing-agent-keys', () => {
    const migrated = resetAgentSettings(oldSlice({ language: 'ru' }));

    expect(migrated).toEqual({
        _persist: OLD_PERSIST,
        language: 'ru',
        agentMaxTokens: 100000,
        agentIterations: 20,
    });
});

test('persistence-migration-replaces-non-numeric-values', () => {
    for (const broken of ['100k', null, '', {}, [], true, Number.NaN]) {
        const migrated = resetAgentSettings(
            oldSlice({ agentMaxTokens: broken, agentIterations: broken })
        );

        expect(agentSettingsOf(migrated)).toEqual({
            agentMaxTokens: 100000,
            agentIterations: 20,
        });
    }
});

test('persistence-migration-keeps-other-keys', () => {
    // несохранённый проект гостя, согласие и высота поля переживают миграцию как есть
    const lastProgram = {
        segments: [
            {
                id: 1,
                type: 'latex',
                text: 'x',
                parameters: { visible: true },
            },
        ],
        parameters: { roundStrategy: 'noRound' },
    };
    const before = oldSlice({
        language: 'ru',
        lastProgram,
        instructionExpanded: false,
        lastOpenedProjectUuid: 'p-1',
        agentMaxTokens: 10000,
        agentIterations: 5,
        crossBorderConsentAcceptedLocally: true,
        agentPromptHeight: 300,
        unknownKey: 'stays',
    });
    const snapshot = JSON.parse(JSON.stringify(before));

    const migrated = resetAgentSettings(before) as unknown as Record<
        string,
        unknown
    >;

    expect(migrated).toEqual({
        ...snapshot,
        agentMaxTokens: 100000,
        agentIterations: 20,
    });
    expect(migrated.lastProgram).toBe(lastProgram);
    // вход не меняется: redux-persist может держать ссылку на него
    expect(before).toEqual(snapshot);
});

test('persistence-migration-never-throws', () => {
    const inputs = [
        undefined,
        null,
        0,
        42,
        'PERSISTENCE',
        true,
        [],
        Object.freeze({ _persist: OLD_PERSIST }),
    ];
    for (const input of inputs) {
        expect(() =>
            resetAgentSettings(input as unknown as PersistedState)
        ).not.toThrow();
    }
    // что не объект, возвращается как есть: создавать срез из ничего не её дело
    expect(resetAgentSettings(undefined)).toBeUndefined();
});

test('persistence-migrate-runs-once-for-an-old-slice', async () => {
    const migrated = await migratePersistence(
        oldSlice({ agentMaxTokens: 10000, agentIterations: 5, language: 'en' }),
        PERSISTENCE_VERSION
    );

    expect(agentSettingsOf(migrated)).toEqual({
        agentMaxTokens: 100000,
        agentIterations: 20,
    });
});

test('persistence-migrate-keeps-a-choice-made-after-migration', async () => {
    // после первой загрузки срез лежит уже с версией 1, и выбор человека трогать нельзя
    const current = {
        agentMaxTokens: 30000,
        agentIterations: 12,
        _persist: { version: PERSISTENCE_VERSION, rehydrated: true },
    } as unknown as PersistedState;

    const migrated = await migratePersistence(current, PERSISTENCE_VERSION);

    expect(agentSettingsOf(migrated)).toEqual({
        agentMaxTokens: 30000,
        agentIterations: 12,
    });
});

test('persistence-migrate-leaves-a-fresh-browser-to-initial-state', async () => {
    await expect(
        migratePersistence(undefined, PERSISTENCE_VERSION)
    ).resolves.toBeUndefined();
});
