import { configureStore } from '@reduxjs/toolkit';
import { persistStore, type PersistedState } from 'redux-persist';
import { createRootReducer } from '../../view/store/reducers';
import { setAgentCompilationAllowed } from '../../view/store/slices/persistence';
import {
    PERSISTENCE_VERSION,
    migratePersistence,
    resetAgentSettings,
} from '../../view/store/persistMigrations.ts';

/** Так срез лежал в localStorage до первой миграции: redux-persist сам ставит -1, когда version не задан */
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
        agentIterations: 500,
    });
});

test('persistence-migration-replaces-values-chosen-by-hand', () => {
    // значение по умолчанию, которое не трогали, в хранилище не отличить от выбранного
    const migrated = resetAgentSettings(
        oldSlice({ agentMaxTokens: 30000, agentIterations: 12 })
    );

    expect(agentSettingsOf(migrated)).toEqual({
        agentMaxTokens: 100000,
        agentIterations: 500,
    });
});

test('persistence-migration-fills-an-empty-slice', () => {
    const migrated = resetAgentSettings(oldSlice({}));

    expect(migrated).toEqual({
        _persist: OLD_PERSIST,
        agentMaxTokens: 100000,
        agentIterations: 500,
    });
});

test('persistence-migration-fills-missing-agent-keys', () => {
    const migrated = resetAgentSettings(oldSlice({ language: 'ru' }));

    expect(migrated).toEqual({
        _persist: OLD_PERSIST,
        language: 'ru',
        agentMaxTokens: 100000,
        agentIterations: 500,
    });
});

test('persistence-migration-replaces-non-numeric-values', () => {
    for (const broken of ['100k', null, '', {}, [], true, Number.NaN]) {
        const migrated = resetAgentSettings(
            oldSlice({ agentMaxTokens: broken, agentIterations: broken })
        );

        expect(agentSettingsOf(migrated)).toEqual({
            agentMaxTokens: 100000,
            agentIterations: 500,
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
        agentIterations: 500,
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
        agentIterations: 500,
    });
});

test('persistence-migrate-resets-a-slice-saved-with-the-previous-lists', async () => {
    // версия 1 хранит значения прежних списков: 20 итераций в новом списке нет, и ни одна кнопка не была бы выбрана
    const previous = {
        agentMaxTokens: 100000,
        agentIterations: 20,
        _persist: { version: 1, rehydrated: true },
    } as unknown as PersistedState;

    const migrated = await migratePersistence(previous, PERSISTENCE_VERSION);

    expect(agentSettingsOf(migrated)).toEqual({
        agentMaxTokens: 100000,
        agentIterations: 500,
    });
});

test('persistence-migrate-keeps-a-choice-made-after-migration', async () => {
    // после первой загрузки срез лежит уже с текущей версией, и выбор человека трогать нельзя
    const current = {
        agentMaxTokens: 300000,
        agentIterations: 1000,
        _persist: { version: PERSISTENCE_VERSION, rehydrated: true },
    } as unknown as PersistedState;

    const migrated = await migratePersistence(current, PERSISTENCE_VERSION);

    expect(agentSettingsOf(migrated)).toEqual({
        agentMaxTokens: 300000,
        agentIterations: 1000,
    });
});

test('persistence-migrate-leaves-a-fresh-browser-to-initial-state', async () => {
    await expect(
        migratePersistence(undefined, PERSISTENCE_VERSION)
    ).resolves.toBeUndefined();
});

// Галка компиляции появилась без подъёма версии: сохранённый срез без неё берёт значение из начального состояния

/** Так redux-persist кладёт срез в localStorage: каждое поле отдельной JSON-строкой */
const seedSlice = (fields: Record<string, unknown>) =>
    window.localStorage.setItem(
        'persist:PERSISTENCE',
        JSON.stringify(
            Object.fromEntries(
                Object.entries(fields).map(([key, value]) => [
                    key,
                    JSON.stringify(value),
                ])
            )
        )
    );

/** Стор собирается как в приложении и ждёт, пока срез поднимется из localStorage */
const rehydratedStore = async () => {
    const store = configureStore({
        reducer: createRootReducer(),
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
    const persistor = persistStore(store);
    await new Promise<void>((resolve) => {
        const check = () => {
            if (persistor.getState().bootstrapped) {
                resolve();
            }
        };
        persistor.subscribe(check);
        check();
    });
    return { store, persistor };
};

const rehydratedPersistence = async () => {
    const { store, persistor } = await rehydratedStore();
    persistor.pause();
    return store.getState().persistence;
};

afterEach(() => window.localStorage.clear());

test('persistence-rehydrate-allows-compilation-for-a-slice-saved-without-it', async () => {
    // версия 2 лежит у всех, кто уже заходил: выбранные итерации и контекст трогать нельзя
    seedSlice({
        agentMaxTokens: 200000,
        agentIterations: 1000,
        _persist: { version: 2, rehydrated: true },
    });

    const persistence = await rehydratedPersistence();

    expect(persistence.agentCompilationAllowed).toBe(true);
    expect(persistence.agentIterations).toBe(1000);
    expect(persistence.agentMaxTokens).toBe(200000);
});

test('persistence-rehydrate-allows-compilation-for-a-slice-older-than-the-migration', async () => {
    seedSlice({
        agentMaxTokens: 10000,
        agentIterations: 5,
        _persist: OLD_PERSIST,
    });

    const persistence = await rehydratedPersistence();

    expect(persistence.agentCompilationAllowed).toBe(true);
    expect(persistence.agentIterations).toBe(500);
});

test('persistence-keeps-compilation-turned-off-after-a-reload', async () => {
    const before = await rehydratedStore();
    before.store.dispatch(setAgentCompilationAllowed(false));
    // срез пишется в localStorage по таймеру, flush дописывает его сразу
    await before.persistor.flush();
    before.persistor.pause();

    const persistence = await rehydratedPersistence();

    expect(persistence.agentCompilationAllowed).toBe(false);
});
