import classNames from 'classnames';
import { useSelector } from 'react-redux';
import { Ide } from './ide';
import { ProblemViewer } from './problemViewer';
import { SyncButtons } from '../syncButtons';
import { TextFileEditor } from './textFileEditor';
import { ImageFilePreview } from './imageFilePreview';
import { StorageState } from '../../../store';

import './style.scss';
import './textFileEditor/style.scss';
import './imageFilePreview/style.scss';

export const Editor = () => {
    const activeTextFile = useSelector(
        (state: StorageState) => state.ide.activeTextFile
    );
    const activeImageFile = useSelector(
        (state: StorageState) => state.ide.activeImageFile
    );

    const mainPanel = activeTextFile ? (
        <TextFileEditor />
    ) : activeImageFile ? (
        <ImageFilePreview />
    ) : (
        <Ide />
    );

    return (
        <div
            className={classNames('editor-container', {
                'editor-container--text-file': Boolean(activeTextFile),
            })}
        >
            {mainPanel}
            <ProblemViewer />
            <SyncButtons />
        </div>
    );
};
