import './style.scss';
import { Editor } from './editor';
import { Viewer } from './viewer';
import { useDispatch, useSelector } from 'react-redux';
import { FileManager } from './fileManager';
import { AppDispatch, StorageState } from '../../store';
import { useHotkeys } from 'react-hotkeys-hook';
import { controller } from '../../../main.tsx';
import { DeleteFilesModal } from './modals/delete-files';
import { TextFileEditorPanel } from './editor/textFileEditor/TextFileEditorPanel';
import './editor/textFileEditor/style.scss';

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

    return (
        <div className="project-container">
            <FileManager />
            <Editor />
            <Viewer />
            {activeTextFile ? <TextFileEditorPanel /> : null}
            <DeleteFilesModal />
        </div>
    );
};

export default ProjectPage;
