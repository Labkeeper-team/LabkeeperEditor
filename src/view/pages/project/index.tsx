import './style.scss';
import { Editor } from './editor';
import { Viewer } from './viewer';
import { useDispatch } from 'react-redux';
import { FileManager } from './fileManager';
import { AppDispatch } from '../../../viewModel/store';
import { useHotkeys } from 'react-hotkeys-hook';
import { onProjectPageEscButtonClicked } from '../../../controller';

export const ProjectPage = () => {
    const dispatch = useDispatch<AppDispatch>();

    /*
     * ACTIONS
     */

    // WHEN ESC CLICKED
    useHotkeys('esc', () => dispatch(onProjectPageEscButtonClicked()), {
        enableOnFormTags: true,
        enabled: true,
        enableOnContentEditable: true,
    });

    return (
        <div className="project-container">
            <FileManager />
            <Editor />
            <Viewer />
        </div>
    );
};
