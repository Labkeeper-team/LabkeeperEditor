import { createMigrate, type PersistedState } from 'redux-persist';
import {
    AGENT_DEFAULT_ITERATIONS,
    AGENT_DEFAULT_MAX_TOKENS,
} from '../../model/rpi/agentSocket.ts';

/** Версия среза PERSISTENCE в localStorage. Срез без версии redux-persist считает версией -1 */
export const PERSISTENCE_VERSION = 2;

/** Разово ставит новые значения агента по умолчанию всем, иначе autoMergeLevel1 положил бы поверх них сохранённые значения из прежних списков; не бросает, потому что при ошибке миграции redux-persist запишет начальное состояние поверх сохранённого, и гость потеряет несохранённый проект и согласие */
export const resetAgentSettings = (state: PersistedState): PersistedState => {
    if (!state || typeof state !== 'object') {
        return state;
    }
    return {
        ...state,
        agentMaxTokens: AGENT_DEFAULT_MAX_TOKENS,
        agentIterations: AGENT_DEFAULT_ITERATIONS,
    } as PersistedState;
};

export const migratePersistence = createMigrate({
    [PERSISTENCE_VERSION]: resetAgentSettings,
});
