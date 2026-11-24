import { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useStore } from 'react-redux';
import {
    useLocation,
    useNavigate,
    useNavigationType,
    useParams,
} from 'react-router-dom';
import { controller } from '../../main.tsx';
import { Events } from '../../model/service/ObserverService.ts';
import { AGENT_MODE_SUFFIX } from '../../viewModel/utils/agentModePath.ts';
import { AppDispatch, StorageState } from '../store';
import { setMobileView, setViewerTab } from '../store/slices/settings';
import { useIsMobile } from './useMobile';

/** Кнопки перехода кладут в историю, откуда пришёл человек */
type AgentModeLocationState = { agentModeSource?: string } | null;

/**
 * Агентский режим: на странице остаются только агент и собранный PDF.
 * Отличается от обычного режима адресом, поэтому его можно открыть ссылкой
 * и вернуть кнопкой «назад» в браузере. GH-279: на телефоне режима нет,
 * там экран за раз один, и агент всегда четвёртый экран рядом с файлами,
 * редактором и PDF
 */
export const useIsAgentMode = (): boolean => {
    const { pathname } = useLocation();
    const isMobile = useIsMobile();
    return !isMobile && pathname.endsWith(AGENT_MODE_SUFFIX);
};

/** На телефоне вместо агентского режима открывается экран агента */
const useShowMobileAgent = () => {
    const dispatch = useDispatch<AppDispatch>();
    return useCallback(() => {
        dispatch(setViewerTab('chat'));
        dispatch(setMobileView('chat'));
    }, [dispatch]);
};

export const useAgentModeNavigation = () => {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const isAgentMode = useIsAgentMode();
    const isMobile = useIsMobile();
    const showMobileAgent = useShowMobileAgent();

    // id из параметров нет у /project/default, поэтому режем сам путь
    const projectPath = pathname.endsWith(AGENT_MODE_SUFFIX)
        ? pathname.slice(0, -AGENT_MODE_SUFFIX.length)
        : pathname;

    const enterAgentMode = useCallback(
        (source: string) => {
            if (isMobile) {
                showMobileAgent();
                return;
            }
            if (isAgentMode) {
                return;
            }
            navigate(`${projectPath}${AGENT_MODE_SUFFIX}`, {
                state: { agentModeSource: source },
            });
        },
        [isAgentMode, isMobile, navigate, projectPath, showMobileAgent]
    );

    const leaveAgentMode = useCallback(
        (source: string) => {
            if (!isAgentMode) {
                return;
            }
            navigate(projectPath, { state: { agentModeSource: source } });
        },
        [isAgentMode, navigate, projectPath]
    );

    return { isAgentMode, enterAgentMode, leaveAgentMode };
};

/**
 * Вход в агентский режим и выход из него уходят в аналитику при любом
 * переходе, а не только по кнопкам: режим открывают ссылкой, перезагрузкой
 * и кнопками «назад» и «вперёд» в браузере. Хук живёт на странице проекта,
 * она при смене режима не пересоздаётся, поэтому прошлый режим помнит ref
 */
export const useAgentModeTracking = () => {
    const isAgentMode = useIsAgentMode();
    const location = useLocation();
    const navigationType = useNavigationType();
    const { id } = useParams();
    const previousRef = useRef<boolean | null>(null);

    useEffect(() => {
        const previous = previousRef.current;
        previousRef.current = isAgentMode;
        // обычный режим при открытии страницы переходом не считается
        if (previous === isAgentMode || (previous === null && !isAgentMode)) {
            return;
        }
        // состояние истории переживает перезагрузку и «вперёд», поэтому
        // источник из него берём только для перехода внутри приложения
        const state = location.state as AgentModeLocationState;
        const source =
            previous === null
                ? 'page_load'
                : navigationType === 'POP'
                  ? 'history'
                  : (state?.agentModeSource ?? 'link');
        controller.trackUiEvent(
            isAgentMode
                ? Events.EVENT_AGENT_MODE_ENTERED
                : Events.EVENT_AGENT_MODE_LEFT,
            { source, ...(id ? { project_id: id } : {}) }
        );
    }, [id, isAgentMode, location.state, navigationType]);
};

/**
 * GH-279: адрес агентского режима на телефоне (ссылка «ИИ-агент» с сайта,
 * новый проект с агентом, окно сузили) заменяется обычным адресом проекта,
 * и открывается экран агента. Собирающийся проект остаётся на PDF: его
 * выбрали намеренно, чтобы был виден ход сборки
 */
export const useMobileAgentModeRedirect = () => {
    const navigate = useNavigate();
    const { pathname, search, state } = useLocation();
    const isMobile = useIsMobile();
    const store = useStore<StorageState>();
    const showMobileAgent = useShowMobileAgent();

    useEffect(() => {
        if (!isMobile || !pathname.endsWith(AGENT_MODE_SUFFIX)) {
            return;
        }
        if (store.getState().settings.mobileView !== 'pdf') {
            showMobileAgent();
        }
        navigate(`${pathname.slice(0, -AGENT_MODE_SUFFIX.length)}${search}`, {
            replace: true,
            state,
        });
    }, [isMobile, navigate, pathname, search, showMobileAgent, state, store]);
};
