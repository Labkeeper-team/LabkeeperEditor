import classNames from 'classnames';
import { Instruction } from './instruction';
import { Result } from './result';
import './style.scss';
import { useSelector } from 'react-redux';
import { useIsProjectReadonly } from '../../../store/selectors/program.ts';
import { StorageState } from '../../../store';
import { SynctexButton } from '../syncButtons';
import { useIsMobile } from '../../../hooks/useMobile';
import { CloneProjectButton } from '../cloneProjectButton';
import { ViewerTabs } from './ViewerTabs';
import { AgentChat } from './chat';
import { useIsAgentMode } from '../../../hooks/useAgentMode';
import { useDictionary } from '../../../store/selectors/translations';

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

    return (
        <div
            className={classNames('viewer-container', {
                'viewer-container--chat': isChat,
            })}
        >
            <div className="viewer-header">
                {isAgentMode ? (
                    <span className="viewer-header__title">
                        {dictionary.agent_chat.pdf_tab_label}
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
                Где чату не хватает высоты, под ним её прячут стили */}
            <Instruction />
        </div>
    );
};
