import { Instruction } from './instruction';
import { Result } from './result';
import './style.scss';

export const Viewer = () => {
    return (
        <div className="viewer-container">
            <Result />
            <Instruction />
        </div>
    );
};
