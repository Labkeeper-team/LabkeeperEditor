import { useDispatch, useSelector } from 'react-redux';
import './style.scss';
import { AddBlock } from '../addBlock';
import { HistoryButtons } from './historyButtons';
import {
    useCurrentProgram,
    useUser,
} from '../../../../../../viewModel/store/selectors/program';
import { SettingsButton } from './settingsButtons';
import { FolderIcon } from '../../../../../icons';
import { AppDispatch, StorageState } from '../../../../../../viewModel/store';
import { onFolderButtonClickedRequest } from '../../../../../../controller';

export const IdeHeader = () => {
    const program = useSelector(useCurrentProgram);
    const { isAuthenticated } = useSelector(useUser);
    const dispatch = useDispatch<AppDispatch>();
    const showFileManager = useSelector(
        (state: StorageState) => state.settings.showFileManager
    );
    const isReadonly = useSelector(
        (state: StorageState) => state.project.projectIsReadonly
    );

    return (
        <div className="ide-header">
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 24,
                }}
            >
                {isAuthenticated ? (
                    !showFileManager ? (
                        <div
                            className="file-manager-button "
                            onClick={() =>
                                dispatch(onFolderButtonClickedRequest())
                            }
                        >
                            <FolderIcon />
                        </div>
                    ) : null
                ) : null}
                {!isReadonly && <HistoryButtons />}
            </div>
            {program?.segments.length && !isReadonly ? (
                <AddBlock isFirst={false} />
            ) : (
                <div />
            )}
            {!isReadonly && <SettingsButton />}
        </div>
    );
};
