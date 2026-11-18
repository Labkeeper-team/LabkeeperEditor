import { memo } from 'react';
import { useSelector } from 'react-redux';
import classNames from 'classnames';
import { StorageState } from '../../store';
import { useIsMobile } from '../../hooks/useMobile';
import './style.scss';
import { orderParticipants, participantInitials } from './participants.ts';
import { useDictionary } from '../../store/selectors/translations.ts';

/** Avatars shown before the "+N" counter */
const MAX_VISIBLE = 5;
const MAX_VISIBLE_MOBILE = 3;

const selectParticipantsView = (state: StorageState) => state.collab;

export const CollabParticipants = memo(() => {
    const collab = useSelector(selectParticipantsView);
    const dictionary = useSelector(useDictionary);
    const isMobile = useIsMobile();
    const active = collab.status === 'live' || collab.status === 'reconnecting';
    if (!active || !collab.participants.length) {
        return null;
    }
    const ordered = orderParticipants(collab.participants, collab.selfUserId);
    const limit = isMobile ? MAX_VISIBLE_MOBILE : MAX_VISIBLE;
    const visible = ordered.slice(0, limit);
    const hidden = ordered.slice(limit);
    return (
        <div
            className={classNames('collab-participants', {
                'collab-participants--offline':
                    collab.status === 'reconnecting',
            })}
            data-testid="collab-participants"
            aria-label="Participants"
            title={
                collab.maxParticipants
                    ? dictionary.collab.participants_count
                          .replace('${count}', String(ordered.length))
                          .replace('${limit}', String(collab.maxParticipants))
                    : undefined
            }
        >
            {visible.map((participant) => {
                const isSelf = participant.userId === collab.selfUserId;
                const title = isSelf
                    ? `${participant.displayName} (you)`
                    : participant.displayName;
                return (
                    <span
                        key={participant.userId}
                        className={classNames('collab-participant', {
                            'collab-participant--self': isSelf,
                        })}
                        style={{ backgroundColor: participant.color }}
                        title={title}
                        aria-label={title}
                        data-testid="collab-participant"
                        data-user-id={participant.userId}
                    >
                        {participantInitials(participant.displayName)}
                    </span>
                );
            })}
            {hidden.length ? (
                <span
                    className="collab-participant collab-participant--more"
                    title={hidden.map((p) => p.displayName).join(', ')}
                >
                    +{hidden.length}
                </span>
            ) : null}
        </div>
    );
});

/**
 * The project already has the maximum number of people editing: this user was not let
 * into the collaboration session and the editor works as without it.
 */
export const CollabParticipantLimitNotice = memo(() => {
    const limit = useSelector(
        (state: StorageState) => state.collab?.participantLimit ?? null
    );
    const dictionary = useSelector(useDictionary);
    if (limit === null) {
        return null;
    }
    return (
        <div
            className="collab-limit-notice"
            role="status"
            data-testid="collab-participant-limit"
        >
            {dictionary.collab.participant_limit.replace(
                '${limit}',
                String(limit)
            )}
        </div>
    );
});
