import { CollabParticipant } from '../../../model/rpi/collabSocket.ts';

/** Up to two letters: first letters of the name parts, or the first two letters */
export function participantInitials(displayName: string): string {
    const parts = displayName
        .trim()
        .split(/[\s._\-+@]+/)
        .filter(Boolean);
    if (!parts.length) {
        return '?';
    }
    const initials =
        parts.length > 1
            ? `${Array.from(parts[0])[0]}${Array.from(parts[1])[0]}`
            : Array.from(parts[0]).slice(0, 2).join('');
    return initials.toUpperCase();
}

/**
 * One entry per user (the server merges tabs already, this is a safety net); the
 * current user comes first and is marked as "you".
 */
export function orderParticipants(
    participants: CollabParticipant[],
    selfUserId: number | null
): CollabParticipant[] {
    const seen = new Set<number>();
    const unique = participants.filter((participant) => {
        if (seen.has(participant.userId)) {
            return false;
        }
        seen.add(participant.userId);
        return true;
    });
    const self = unique.filter((p) => p.userId === selfUserId);
    const others = unique.filter((p) => p.userId !== selfUserId);
    return [...self, ...others];
}
