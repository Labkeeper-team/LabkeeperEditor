import classNames from 'classnames';
import { useRef } from 'react';
import { Instruction } from './instruction';
import { Result } from './result';
import './style.scss';
import { useSelector } from 'react-redux';
import {
    useInstructionsExpanded,
    useIsProjectReadonly,
} from '../../../store/selectors/program.ts';
import { StorageState } from '../../../store';
import { SynctexButton } from '../syncButtons';
import { useIsMobile } from '../../../hooks/useMobile';
import { CloneProjectButton } from '../cloneProjectButton';
import { ViewerTabs } from './ViewerTabs';
import { AgentChat } from './chat';
import { useIsAgentMode } from '../../../hooks/useAgentMode';
import { useDictionary } from '../../../store/selectors/translations';
import { useHelpRoom } from './useHelpRoom.ts';

import '../editor/ide/header/settingsButtons/markdownType/style.scss';

export const Viewer = () => {
    const isReadonly = useSelector(useIsProjectReadonly);
    const isMobile = useIsMobile();
    const isAgentMode = useIsAgentMode();
    const dictionary = useSelector(useDictionary);
    const viewerTab = useSelector(
        (state: StorageState) => state.settings.viewerTab
    );
    // в агентском режиме чат занимает свою колонку, здесь только результат,
    // и переключать вкладками нечего
    const isChat = !isAgentMode && viewerTab === 'chat' && !isReadonly;
    const isChatEmpty = useSelector(
        (state: StorageState) =>
            state.chat.messages.length === 0 && state.chat.history.length === 0
    );
    const helpExpanded = useSelector(useInstructionsExpanded);
    const columnRef = useRef<HTMLDivElement>(null);
    const helpRoom = useHelpRoom(columnRef, helpExpanded);
    // под PDF помощь есть всегда, а чат сначала должен поместиться сам:
    // пустому хватает поля запроса, с перепиской нужна ещё и лента
    const helpFits =
        !isChat || helpRoom === 'any' || (helpRoom === 'empty' && isChatEmpty);

    return (
        <div
            ref={columnRef}
            className={classNames('viewer-container', {
                'viewer-container--no-help': !helpFits,
            })}
        >
            <div className="viewer-header">
                {isAgentMode ? (
                    <span className="viewer-header__title">
                        {dictionary.agent_mode.document}
                    </span>
                ) : (
                    <ViewerTabs />
                )}
                {isMobile ? (
                    <div
                        className="ide-wrapper"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                        }}
                    >
                        <SynctexButton direction="toEditor" />
                    </div>
                ) : null}
                {isReadonly && isMobile ? <CloneProjectButton /> : null}
            </div>
            {/* Result не размонтируем: pdf.js держит документ и позицию прокрутки
                в своём состоянии, и переключение вкладки перекачивало бы файл */}
            <div className="viewer-pane" hidden={isChat}>
                <Result />
            </div>
            {isChat && <AgentChat />}
            {/* помощь видна и под агентом: подсказки нужны и тем, кто начинает с чата.
                Прячем стилем, а не убираем из дерева: иначе слайды листались бы с начала */}
            <Instruction />
        </div>
    );
};
