import { Tooltip } from 'react-tooltip';
import { HintProps } from './model';

import './style.scss';

export const Hint = (props: HintProps) => {
    return (
        <>
            <a
                onClick={(e) => {
                    e.stopPropagation();
                }}
                id={props.anchor}
                className={`hint-container`}
                style={props.position}
            />
            <Tooltip
                wrapper={'div'}
                style={{
                    background: '#ffffff',
                    borderRadius: '8px',
                    color: 'black',
                    whiteSpace: 'pre-wrap',
                    zIndex: 1000,
                }}
                anchorSelect={`#${props.anchor}`}
                place={props.hintPosition}
            >
                {props.text}
            </Tooltip>
        </>
    );
};
