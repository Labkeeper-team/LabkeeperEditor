import { Ide } from './ide';
import { ProblemViewer } from './problemViewer';

import './style.scss';

export const Editor = () => {
  return (
      <div className="editor-container">
        <Ide />
        <ProblemViewer />
      </div>
  );
};
