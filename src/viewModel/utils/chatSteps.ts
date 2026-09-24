import { ChatMessage } from '../repository';

export interface ChatStepGroups {
    /** По индексу ленты: id запроса, под которым строка шага свёрнута, или null, если она всегда на виду */
    stepOwner: (number | null)[];
    /** Сколько строк шагов у каждого прошлого прогона по id его запроса; прогоны без строк и текущий сюда не попадают */
    pastStepCounts: Record<number, number>;
}

/** Прошлые прогоны это те, после которых уже отправлен новый запрос; прячутся только их строки шагов, а ответ, ошибка и оговорка с перечнем изменений остаются на виду */
export function groupChatSteps(messages: ChatMessage[]): ChatStepGroups {
    let lastRequestIndex = -1;
    messages.forEach((message, index) => {
        if (message.kind === 'request') {
            lastRequestIndex = index;
        }
    });

    const stepOwner: (number | null)[] = [];
    const pastStepCounts: Record<number, number> = {};
    let owner: number | null = null;
    messages.forEach((message, index) => {
        if (message.kind === 'request') {
            owner = message.id;
        }
        if (
            message.kind !== 'event' ||
            owner === null ||
            index > lastRequestIndex
        ) {
            stepOwner.push(null);
            return;
        }
        stepOwner.push(owner);
        pastStepCounts[owner] = (pastStepCounts[owner] ?? 0) + 1;
    });
    return { stepOwner, pastStepCounts };
}
