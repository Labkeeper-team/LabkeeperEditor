import { useSelector } from 'react-redux';
import { Ide } from './ide';
import { ProblemViewer } from './problemViewer';
import { SyncButtons } from '../syncButtons';
import { TextFileEditor } from './textFileEditor';
import { StorageState } from '../../../store';

import './style.scss';
import './textFileEditor/style.scss';

export const Editor = () => {
    const activeTextFile = useSelector(
        (state: StorageState) => state.ide.activeTextFile
    );

    return (
        <div className="editor-container">
            {activeTextFile ? <TextFileEditor /> : <Ide />}
            <ProblemViewer />
            <SyncButtons />
        </div>
    );
};
