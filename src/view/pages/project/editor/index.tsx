import { Ide } from './ide';
import { ProblemViewer } from './problemViewer';
import { SyncButtons } from '../syncButtons';

import './style.scss';

export const Editor = () => {
    return (
        <div className="editor-container">
            <Ide />
            <ProblemViewer />
            <SyncButtons />
        </div>
    );
};
