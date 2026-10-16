import { flushSync } from 'react-dom';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { useHotkeys } from 'react-hotkeys-hook';

import { AppDispatch, StorageState } from '../../../store';
import { MobileView } from '../../../store/slices';
import {
    readIsAgentRunning,
    useCompiledErrors,
    useCurrentProject,
    useIsProjectReadonly,
} from '../../../store/selectors/program';
import { setMobileView, setShowSearch } from '../../../store/slices/settings';
import { controller } from '../../../../main.tsx';
import { Events } from '../../../../model/service/ObserverService.ts';
import { useIsMobile } from '../../../hooks/useMobile';
import { useAgentModeNavigation } from '../../../hooks/useAgentMode';
import { useRunAction } from '../editor/runButton/useRunAction.ts';
import { useSynctexNavigation } from '../syncButtons/useSynctexNavigation.ts';
import { useSelectViewerTab } from '../viewer/useSelectViewerTab.ts';
import { HotkeyCode, isMacPlatform, PROJECT_HOTKEYS } from './catalog.ts';
import {
    focusChatPrompt,
    focusResultPanel,
    focusSearchInput,
    focusSegmentEditor,
} from './focus.ts';

/**
 * fired: действие сработало, уходит hotkey_used.
 * handled: сочетание наше, но делать нечего, например сборка выключена; клавишу всё равно гасим,
 * иначе её подхватил бы CodeMirror (Ctrl+Enter вставил бы строку, Alt+↑ передвинул бы её).
 * skip: здесь этого действия нет вовсе, клавиша идёт браузеру как раньше
 */
type Outcome = 'fired' | 'handled' | 'skip';

const CODE_BY_HOTKEY = new Map(
    Object.entries(PROJECT_HOTKEYS).map(([code, hotkey]) => [
        hotkey,
        code as HotkeyCode,
    ])
);

// удержание повторяет только переходы, а сборку, панели и режим нет
const REPEATABLE = new Set<HotkeyCode>([
    'search_next',
    'search_prev',
    'segment_prev',
    'segment_next',
]);

const IS_MAC = isMacPlatform();

/** На Windows AltGr приходит как Ctrl+Alt: им набирают буквы (польская ć, немецкая @), и чужая клавиша их съела бы */
const isAltGraph = (event: KeyboardEvent) =>
    !IS_MAC &&
    typeof event.getModifierState === 'function' &&
    event.getModifierState('AltGraph');

/** GH-172: сочетания страницы проекта. Действия те же, что у кнопок, поэтому условия берутся у них */
export const useProjectHotkeys = () => {
    const dispatch = useDispatch<AppDispatch>();
    const store = useStore<StorageState>();
    const isMobile = useIsMobile();
    const { isAgentMode, enterAgentMode, leaveAgentMode } =
        useAgentModeNavigation();
    const project = useSelector(useCurrentProject);
    const isReadonly = useSelector(useIsProjectReadonly);
    const errors = useSelector(useCompiledErrors);
    const activeTextFile = useSelector(
        (state: StorageState) => state.ide.activeTextFile
    );
    const activeImageFile = useSelector(
        (state: StorageState) => state.ide.activeImageFile
    );
    const showHotkeysHelp = useSelector(
        (state: StorageState) => state.settings.showHotkeysHelp
    );
    const runAction = useRunAction();
    const syncToPdf = useSynctexNavigation('toPdf');
    const syncToEditor = useSynctexNavigation('toEditor');
    const selectViewerTab = useSelectViewerTab();

    // список сегментов с шапкой поиска и кнопкой добавления: в агентском режиме
    // и в открытом файле на его месте другое
    const segmentsShown = !isAgentMode && !activeTextFile && !activeImageFile;
    const canEdit = Boolean(project) && !isReadonly;

    /** На телефоне колонки это разные экраны: действие открывает свой */
    const showPane = (view: MobileView) => {
        if (isMobile) {
            dispatch(setMobileView(view));
        }
    };

    const openSearch = (): Outcome => {
        // поле показываем сразу, в этом же нажатии: иначе первые буквы быстрого набора ушли бы мимо него
        flushSync(() => {
            showPane('editor');
            dispatch(setShowSearch(true));
        });
        focusSearchInput();
        return 'fired';
    };

    const stepSearch = (direction: 'next' | 'previous'): Outcome => {
        if (!segmentsShown || !canEdit) {
            return 'skip';
        }
        // искать ещё нечего: F3 открывает поле, как Ctrl+F
        if (!store.getState().ide.searchInput) {
            openSearch();
            return 'handled';
        }
        dispatch(
            direction === 'next'
                ? controller.onSearchSubmitRequest()
                : controller.onSearchPreviousRequest()
        );
        return 'fired';
    };

    const moveToSegment = (step: 1 | -1): Outcome => {
        if (!segmentsShown) {
            return 'skip';
        }
        const state = store.getState();
        const count = state.project.currentProgram?.segments.length ?? 0;
        if (count === 0) {
            return 'skip';
        }
        const inRange = (index: number) => index >= 0 && index < count;
        // фокус в сегменте или был в нём последним: идём от него
        const current = inRange(state.ide.activeSegmentIndex)
            ? state.ide.activeSegmentIndex
            : inRange(state.ide.previousActiveSegmentIndex)
              ? state.ide.previousActiveSegmentIndex
              : -1;
        const target =
            current === -1
                ? step === 1
                    ? 0
                    : count - 1
                : Math.min(count - 1, Math.max(0, current + step));
        showPane('editor');
        focusSegmentEditor(target);
        return target === current ? 'handled' : 'fired';
    };

    const addLatexSegment = (): Outcome => {
        if (!segmentsShown || !canEdit) {
            return 'skip';
        }
        const state = store.getState();
        const index = state.project.currentProgram?.segments.length ?? 0;
        // во время прогона агента правки закрыты, об этом скажет сам сервис
        const blocked = readIsAgentRunning(state);
        showPane('editor');
        void dispatch(
            controller.onAddSegmentButtonClickedRequest({
                type: 'latex',
                source: 'hotkey',
            })
        ).then(() => {
            const segments =
                store.getState().project.currentProgram?.segments.length ?? 0;
            if (segments > index) {
                focusSegmentEditor(index);
            }
        });
        return blocked ? 'handled' : 'fired';
    };

    const sync = (navigation: typeof syncToPdf): Outcome => {
        if (isAgentMode || !navigation.visible) {
            return 'skip';
        }
        if (!navigation.canNavigate) {
            return 'handled';
        }
        navigation.onActivate();
        return 'fired';
    };

    const sendErrorsToAgent = (): Outcome => {
        if (isAgentMode || isReadonly || !errors?.length) {
            return 'skip';
        }
        void dispatch(controller.onSendErrorsToAgentRequest()).then(() => {
            const state = store.getState();
            // поле занято или агент работает: сервис показал почему, а вкладку не тронул
            if (state.settings.viewerTab === 'chat') {
                focusChatPrompt(state.chat.input);
            }
        });
        return 'fired';
    };

    const actions: Record<HotkeyCode, () => Outcome> = {
        search_open: () => (segmentsShown && canEdit ? openSearch() : 'skip'),
        search_next: () => stepSearch('next'),
        search_prev: () => stepSearch('previous'),
        file_manager: () => {
            // на телефоне файлы это отдельный экран со своим переключателем
            if (isAgentMode || isMobile || !project) {
                return 'skip';
            }
            dispatch(
                store.getState().settings.showFileManager
                    ? controller.onCrossButtonInFileManagerClickedRequest()
                    : controller.onFolderButtonClickedRequest()
            );
            return 'fired';
        },
        sync_to_pdf: () => sync(syncToPdf),
        sync_to_editor: () => sync(syncToEditor),
        segment_prev: () => moveToSegment(-1),
        segment_next: () => moveToSegment(1),
        add_latex: addLatexSegment,
        compile: () => {
            // зелёной кнопки нет в агентском режиме и над картинкой
            if (isAgentMode || activeImageFile) {
                return 'skip';
            }
            return runAction.run('hotkey') ? 'fired' : 'handled';
        },
        send_errors_to_agent: sendErrorsToAgent,
        viewer_pdf: () => {
            if (!project) {
                return 'skip';
            }
            // на чужом проекте вкладок нет, колонка и так показывает результат
            if (!isAgentMode && !isReadonly) {
                selectViewerTab('pdf');
            }
            showPane('pdf');
            focusResultPanel();
            return 'fired';
        },
        viewer_chat: () => {
            if (!project || isReadonly) {
                return 'skip';
            }
            // чат монтируем сразу: иначе набранное вслед ушло бы в сегмент, где стоял фокус
            flushSync(() => {
                if (!isAgentMode) {
                    selectViewerTab('chat');
                }
                showPane('chat');
            });
            focusChatPrompt();
            return 'fired';
        },
        agent_mode: () => {
            if (!project || isReadonly) {
                return 'skip';
            }
            if (isAgentMode) {
                leaveAgentMode('hotkey');
                // как у кнопки выхода: на телефоне иначе остался бы тот же чат
                showPane('editor');
            } else {
                enterAgentMode('hotkey');
            }
            return 'fired';
        },
    };

    useHotkeys(
        Object.values(PROJECT_HOTKEYS),
        (event, handler) => {
            const code = CODE_BY_HOTKEY.get(handler.hotkey);
            if (!code) {
                return;
            }
            const outcome =
                event.repeat && !REPEATABLE.has(code)
                    ? 'handled'
                    : actions[code]();
            if (outcome === 'skip') {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            if (outcome === 'fired') {
                controller.trackUiEvent(Events.EVENT_HOTKEY_USED, {
                    hotkey: code,
                });
            }
        },
        {
            // пока открыт список сочетаний, страница за ним не отвечает
            enabled: !showHotkeysHelp,
            enableOnFormTags: true,
            enableOnContentEditable: true,
            ignoreEventWhen: isAltGraph,
            // до CodeMirror и поля чата: иначе Ctrl+Enter вставил бы строку или ушёл в отправку
            eventListenerOptions: { capture: true },
        }
    );
};
