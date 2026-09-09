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

import '../editor/ide/header/settingsButtons/markdownType/style.scss';

export const Viewer = () => {
    const isReadonly = useSelector(useIsProjectReadonly);
    const isMobile = useIsMobile();
    const viewerTab = useSelector(
        (state: StorageState) => state.settings.viewerTab
    );
    const isChat = viewerTab === 'chat' && !isReadonly;

    return (
        <div className="viewer-container">
            <div className="viewer-header">
                <ViewerTabs />
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
                <Instruction />
            </div>
            {isChat && <AgentChat />}
        </div>
    );
};
