import { useDispatch, useSelector } from 'react-redux';
import './style.scss';
import { AddBlock } from '../addBlock';
import { HistoryButtons } from './historyButtons';
import {
    useCurrentProgram,
    useIsProjectReadonly,
    useShowFileManager,
    useCurrentProject,
} from '../../../../../../viewModel/store/selectors/program';
import { SettingsButton } from './settingsButtons';
import { FolderIcon } from '../../../../../icons';
import { AppDispatch, StorageState } from '../../../../../../viewModel/store';
import {
    onFolderButtonClickedRequest,
    onCloneProjectRequest,
} from '../../../../../../controller';
import { Typography } from '../../../../../components/typography';
import { Button } from '../../../../../components/button';
import { useDictionary } from '../../../../../../viewModel/store/selectors/translations';

export const IdeHeader = () => {
    const program = useSelector(useCurrentProgram);
    const dispatch = useDispatch<AppDispatch>();
    const showFileManager = useSelector(useShowFileManager);
    const isReadonly = useSelector(useIsProjectReadonly);
    const project = useSelector(useCurrentProject);
    const dictionary = useSelector(useDictionary);
    const cloneRequestState = useSelector(
        (state: StorageState) => state.ide.cloneRequestState
    );

    return (
        <div className="ide-header">
            <div className="ide-wrapper">
                {!!project && !showFileManager ? (
                    <div
                        className="file-manager-button "
                        onClick={() => dispatch(onFolderButtonClickedRequest())}
                    >
                        <FolderIcon />
                    </div>
                ) : null}
                {!isReadonly && <HistoryButtons />}
            </div>
            {program?.segments.length && !isReadonly ? (
                <AddBlock isFirst={false} />
            ) : isReadonly && project?.isPublic ? (
                <div className="readonly-public-panel">
                    <div className="readonly-badge">
                        <Typography
                            type="label-small"
                            text={dictionary.readonly_public_project}
                        />
                    </div>
                    {(() => {
                        const isCloneLoading = cloneRequestState === 'loading';
                        const isCloneError = cloneRequestState === 'error';
                        return (
                            <Button
                                title={dictionary.clone}
                                rounded
                                minimize
                                color="green"
                                disabled={isCloneLoading}
                                titleIcon={
                                    isCloneLoading
                                        ? () => (
                                              <span className="ide-clone-spinner" />
                                          )
                                        : isCloneError
                                          ? () => (
                                                <span className="ide-clone-error" />
                                            )
                                          : undefined
                                }
                                onPress={() =>
                                    dispatch(onCloneProjectRequest())
                                }
                            />
                        );
                    })()}
                </div>
            ) : (
                <div />
            )}
            {!isReadonly && <SettingsButton />}
        </div>
    );
};
