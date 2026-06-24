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
import { AppDispatch, StorageState } from '../../../../../store';
import { Typography } from '../../../../../components/typography';
import { Button } from '../../../../../components/button';
import { useDictionary } from '../../../../../store/selectors/translations';
import { controller } from '../../../../../../main.tsx';
import { useIsMobile } from '../../../../../hooks/useMobile';
import { ProjectPanelSwitcher } from '../../../mobilePanelSwitcher';

export const IdeHeader = () => {
    const program = useSelector(useCurrentProgram);
    const dispatch = useDispatch<AppDispatch>();
    const isMobile = useIsMobile();
    const showFileManager = useSelector(useShowFileManager);
    const isReadonly = useSelector(useIsProjectReadonly);
    const project = useSelector(useCurrentProject);
    const dictionary = useSelector(useDictionary);
    const cloneRequestState = useSelector(
        (state: StorageState) => state.ide.cloneRequestState
    );
    const isCloneLoading = cloneRequestState === 'loading';
    const isCloneError = cloneRequestState === 'error';
    const cloneTitleIcon = isCloneLoading
        ? () => <span className="ide-clone-spinner" />
        : isCloneError
          ? () => <span className="ide-clone-error" />
          : undefined;
    const readonlyPublicPanel =
        isReadonly && project?.isPublic ? (
            <div className="readonly-public-panel">
                <div className="readonly-badge">
                    <Typography
                        type="label-small"
                        text={dictionary.readonly_public_project}
                    />
                </div>
                <Button
                    title={dictionary.clone}
                    rounded
                    minimize
                    color="green"
                    disabled={isCloneLoading}
                    titleIcon={cloneTitleIcon}
                    onPress={() => dispatch(controller.onCloneProjectRequest())}
                />
            </div>
        ) : null;

    return (
        <div className="ide-header">
            {!isMobile ? (
                <div className="ide-wrapper">
                    {!!project && !showFileManager ? (
                        <div
                            className="file-manager-button "
                            onClick={() =>
                                dispatch(
                                    controller.onFolderButtonClickedRequest()
                                )
                            }
                        >
                            <FolderIcon />
                        </div>
                    ) : null}
                    {!isReadonly && <HistoryButtons />}
                </div>
            ) : null}
            <div className="ide-header-center">
                {program?.segments.length && !isReadonly ? (
                    <AddBlock isFirst={false} />
                ) : isMobile ? (
                    readonlyPublicPanel
                ) : (
                    <div />
                )}
            </div>
            <div className="ide-header-right">
                {!isReadonly && <SettingsButton />}
                {!isMobile && readonlyPublicPanel}
                <ProjectPanelSwitcher />
            </div>
        </div>
    );
};
