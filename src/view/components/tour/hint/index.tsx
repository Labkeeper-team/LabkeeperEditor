import { Tooltip } from 'react-tooltip';
import { HintProps } from './model';
import { useIsMobile } from '../../../hooks/useMobile';

import './style.scss';

export const Hint = (props: HintProps) => {
    const isMobile = useIsMobile();
    if (props.position.top === undefined || props.position.left === undefined) {
        return null;
    }

    return (
        <>
            <a
                id={props.anchor}
                className={`hint-container`}
                style={props.position}
            />
            <Tooltip
                wrapper={'div'}
                openOnClick={isMobile}
                portalRoot={document.body}
                positionStrategy="fixed"
                style={{
                    background: '#ffffff',
                    borderRadius: '8px',
                    color: 'black',
                    maxWidth: 'min(360px, calc(100vw - 24px))',
                    boxSizing: 'border-box',
                    overflowWrap: 'anywhere',
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
