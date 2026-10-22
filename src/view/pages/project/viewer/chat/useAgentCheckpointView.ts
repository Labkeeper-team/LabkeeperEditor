import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { StorageState } from '../../../../store';
import { selectShownHunks } from '../../../../store/selectors/hunks.ts';
import {
    AgentCheckpointView,
    agentCheckpointView,
} from '../../../../../viewModel/utils/agentCheckpoint.ts';

/**
 * GH-189: что откатится и где это в ленте. Тот же расчёт, что у сервиса,
 * только из стора. null: откатывать нечего или это не агентский режим
 */
export const useAgentCheckpointView = (
    enabled: boolean
): AgentCheckpointView | null => {
    const hunkCount = useSelector(selectShownHunks).length;
    const authenticated = useSelector(
        (state: StorageState) => state.user.isAuthenticated
    );
    const readonly = useSelector(
        (state: StorageState) => state.project.projectIsReadonly
    );
    const projectId = useSelector(
        (state: StorageState) => state.project.project?.projectId
    );
    const history = useSelector((state: StorageState) => state.chat.history);
    const messages = useSelector((state: StorageState) => state.chat.messages);
    const links = useSelector(
        (state: StorageState) => state.chat.entryIdByRequestId
    );
    const fromRequestId = useSelector(
        (state: StorageState) => state.chat.checkpointFromRequestId
    );
    const base = useSelector(
        (state: StorageState) => state.chat.checkpointBase ?? undefined
    );
    return useMemo(
        () =>
            enabled && projectId && !readonly
                ? agentCheckpointView({
                      hunkCount,
                      authenticated,
                      history,
                      links,
                      messages,
                      fromRequestId,
                      base,
                  })
                : null,
        [
            enabled,
            projectId,
            readonly,
            hunkCount,
            authenticated,
            history,
            links,
            messages,
            fromRequestId,
            base,
        ]
    );
};
