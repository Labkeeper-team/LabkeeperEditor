import { useDispatch, useSelector } from 'react-redux';
import './style.scss';
import { AddBlock } from '../addBlock';
import { HistoryButtons } from './historyButtons';
import {
    useCurrentProgram,
    useIsProjectReadonly,
    useShowFileManager,
    useUser,
} from '../../../../../../viewModel/store/selectors/program';
import { SettingsButton } from './settingsButtons';
import { FolderIcon } from '../../../../../icons';
import { AppDispatch } from '../../../../../../viewModel/store';
import { onFolderButtonClickedRequest } from '../../../../../../controller';

export const IdeHeader = () => {
    const program = useSelector(useCurrentProgram);
    const { isAuthenticated } = useSelector(useUser);
    const dispatch = useDispatch<AppDispatch>();
    const showFileManager = useSelector(useShowFileManager);
    const isReadonly = useSelector(useIsProjectReadonly);

    return (
        <div className="ide-header">
            <div className="ide-wrapper">
                {true ? (
                    true ? (
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
