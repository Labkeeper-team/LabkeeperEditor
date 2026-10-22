import {
    AGENT_CHECKPOINT_PROJECTS_LIMIT,
    AgentCheckpointBase,
} from '../../viewModel/utils/agentCheckpoint.ts';

/**
 * GH-189: границы отката по проектам. Лежат отдельным ключом, а не в срезе
 * redux-persist: срез пишется целиком, и вторая вкладка со старым состоянием
 * затёрла бы границу, поставленную первой
 */
const STORAGE_KEY = 'labkeeper.agentCheckpointBases';

const isBase = (value: unknown): value is AgentCheckpointBase => {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const { entryId, createdAt } = value as Record<string, unknown>;
    return (
        (entryId === null || typeof entryId === 'string') &&
        (createdAt === null || typeof createdAt === 'string')
    );
};

function readAll(): Record<string, AgentCheckpointBase> {
    try {
        const parsed: unknown = JSON.parse(
            window.localStorage.getItem(STORAGE_KEY) ?? '{}'
        );
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return {};
        }
        return Object.fromEntries(
            Object.entries(parsed).filter(([, base]) => isBase(base))
        ) as Record<string, AgentCheckpointBase>;
    } catch {
        return {};
    }
}

export function readAgentCheckpointBase(
    projectId: string
): AgentCheckpointBase | undefined {
    return readAll()[projectId];
}

export function writeAgentCheckpointBase(
    projectId: string,
    base: AgentCheckpointBase | undefined
): void {
    // читаем заново перед записью: другая вкладка могла поменять границу своего проекта
    const bases = readAll();
    delete bases[projectId];
    if (base) {
        // свежий проект встаёт в конец, а вытесняются самые давние
        bases[projectId] = base;
        const ids = Object.keys(bases);
        ids.slice(
            0,
            Math.max(0, ids.length - AGENT_CHECKPOINT_PROJECTS_LIMIT)
        ).forEach((id) => delete bases[id]);
    }
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bases));
    } catch {
        // без хранилища граница проживёт только в памяти вкладки
    }
}
