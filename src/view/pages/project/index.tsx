import './style.scss';
import { Editor } from './editor';
import { Viewer } from './viewer';
import { useDispatch, useSelector } from 'react-redux';
import { FileManager } from './fileManager';
import { AppDispatch, StorageState } from '../../store';
import { useHotkeys } from 'react-hotkeys-hook';
import { controller } from '../../../main.tsx';
import { DeleteFilesModal } from './modals/delete-files';
import { PrivacyPolicyAcceptanceModal } from './modals/privacy-policy-acceptance';

export const ProjectPage = () => {
    const dispatch = useDispatch<AppDispatch>();
    const activeTextFile = useSelector(
        (state: StorageState) => state.ide.activeTextFile
    );

    /*
     * ACTIONS
     */

    // WHEN ESC CLICKED
    useHotkeys(
        'esc',
        () => dispatch(controller.onProjectPageEscButtonClickedRequest()),
        {
            enableOnFormTags: true,
            enabled: true,
            enableOnContentEditable: true,
        }
    );

    useHotkeys(
        'mod+s',
        (e) => {
            e?.preventDefault();
            e?.stopPropagation();
            dispatch(controller.onTextFileSaveTimeoutRequest());
        },
        {
            enableOnFormTags: true,
            enabled: Boolean(activeTextFile),
            enableOnContentEditable: true,
            preventDefault: true,
        }
    );

    return (
        <div className="project-container">
            <FileManager />
            <Editor />
            <Viewer />
            <DeleteFilesModal />
            <PrivacyPolicyAcceptanceModal />
        </div>
    );
};

export default ProjectPage;
