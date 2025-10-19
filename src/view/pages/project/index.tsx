import './style.scss';
import { Editor } from './editor';
import { Viewer } from './viewer';
import { useDispatch } from 'react-redux';
import { FileManager } from './fileManager';
import { AppDispatch } from '../../store';
import { useHotkeys } from 'react-hotkeys-hook';
import { controller } from '../../../main.tsx';
import { DeleteFilesModal } from './modals/delete-files';

export const ProjectPage = () => {
    const dispatch = useDispatch<AppDispatch>();

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
            <DeleteFilesModal />
        </div>
    );
};

export default ProjectPage;
