import { useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { controller } from '../../main.tsx';
import { Events } from '../../model/service/ObserverService.ts';

/**
 * Агентский режим: на странице остаются только агент и собранный PDF.
 * Отличается от обычного режима адресом, поэтому его можно открыть ссылкой
 * и вернуть кнопкой «назад» в браузере
 */
const AGENT_PATH_SUFFIX = '/agent';

export const useIsAgentMode = (): boolean => {
    const { pathname } = useLocation();
    return pathname.endsWith(AGENT_PATH_SUFFIX);
};

export const useAgentModeNavigation = () => {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const { id } = useParams();
    const isAgentMode = useIsAgentMode();

    // id из параметров нет у /project/default, поэтому режем сам путь
    const projectPath = isAgentMode
        ? pathname.slice(0, -AGENT_PATH_SUFFIX.length)
        : pathname;

    const enterAgentMode = useCallback(
        (source: string) => {
            if (isAgentMode) {
                return;
            }
            controller.trackUiEvent(Events.EVENT_AGENT_MODE_ENTERED, {
                source,
                ...(id ? { project_id: id } : {}),
            });
            navigate(`${projectPath}${AGENT_PATH_SUFFIX}`);
        },
        [id, isAgentMode, navigate, projectPath]
    );

    const leaveAgentMode = useCallback(() => {
        if (!isAgentMode) {
            return;
        }
        controller.trackUiEvent(Events.EVENT_AGENT_MODE_LEFT, {
            ...(id ? { project_id: id } : {}),
        });
        navigate(projectPath);
    }, [id, isAgentMode, navigate, projectPath]);

    return { isAgentMode, enterAgentMode, leaveAgentMode };
};
