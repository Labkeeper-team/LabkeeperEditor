import { useDispatch, useSelector } from 'react-redux';
import './style.scss';
import { AddBlock } from '../addBlock';
import { HistoryButtons } from './historyButtons';
import {
    useCurrentProgram,
    useIsProjectReadonly,
    useShowFileManager,
    useCurrentProject,
} from '../../../../../store/selectors/program';
import { SettingsButton } from './settingsButtons';
import { FolderIcon } from '../../../../../icons';
import { AppDispatch } from '../../../../../store';
import { controller } from '../../../../../../main.tsx';
import { useIsMobile } from '../../../../../hooks/useMobile';
import { SynctexButton } from '../../../syncButtons';
import { CloneProjectButton } from '../../../cloneProjectButton';
import { hotkeyHint } from '../../../hotkeys/hint.ts';
import { useDictionary } from '../../../../../store/selectors/translations';

export const IdeHeader = () => {
    const program = useSelector(useCurrentProgram);
    const dispatch = useDispatch<AppDispatch>();
    const showFileManager = useSelector(useShowFileManager);
    const isReadonly = useSelector(useIsProjectReadonly);
    const project = useSelector(useCurrentProject);
    const isMobile = useIsMobile();
    const dictionary = useSelector(useDictionary);

    return (
        <div className="ide-header">
            <div className="ide-wrapper">
                {!!project && !showFileManager && !isMobile ? (
                    <div
                        className="file-manager-button "
                        {...hotkeyHint(
                            'file_manager',
                            dictionary.hotkeys.actions.file_manager
                        )}
                        onClick={() =>
                            dispatch(controller.onFolderButtonClickedRequest())
                        }
                    >
                        <FolderIcon />
                    </div>
                ) : null}
                {!isReadonly && <HistoryButtons />}
                {isMobile ? <SynctexButton direction="toPdf" /> : null}
            </div>
            {program?.segments.length && !isReadonly ? (
                <AddBlock isFirst={false} />
            ) : isReadonly && project?.isPublic ? (
                <CloneProjectButton />
            ) : (
                <div />
            )}
            {!isReadonly && <SettingsButton />}
        </div>
    );
};
