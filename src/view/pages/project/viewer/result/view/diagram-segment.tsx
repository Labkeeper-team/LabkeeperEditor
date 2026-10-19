import classNames from 'classnames';
import { forwardRef, ReactNode } from 'react';
import { useSelector } from 'react-redux';

import { useDictionary } from '../../../../../store/selectors/translations';
import { DiagramState } from './diagram.ts';

type DiagramFrameProps = {
    index: number;
    onClick: () => void;
    state: DiagramState;
    /** drawio рисует в скрытом iframe, он должен стоять в разметке */
    children?: ReactNode;
};

export const DiagramFrame = forwardRef<HTMLDivElement, DiagramFrameProps>(
    ({ index, onClick, state, children }, ref) => {
        const dictionary = useSelector(useDictionary);
        return (
            <div
                id={`result-segment-${index}`}
                onMouseDown={() => setTimeout(onClick, 1)}
                ref={ref}
                className={classNames('result-segment', 'result-diagram')}
            >
                {state.status === 'ready' ? (
                    state.picture.kind === 'image' ? (
                        <img
                            className="result-diagram__picture"
                            src={state.picture.src}
                            alt=""
                        />
                    ) : (
                        <div
                            className="result-diagram__picture"
                            dangerouslySetInnerHTML={{
                                __html: state.picture.markup,
                            }}
                        />
                    )
                ) : null}
                {state.status === 'loading' ? (
                    <div className="result-diagram__loading">
                        {dictionary.diagram.loading}
                    </div>
                ) : null}
                {state.status === 'error' ? (
                    <div className="result-diagram__error" role="alert">
                        <div className="result-diagram__error-title">
                            {dictionary.diagram.failed}
                        </div>
                        {state.reason || state.message ? (
                            <pre className="result-diagram__error-text">
                                {state.reason
                                    ? dictionary.diagram[state.reason]
                                    : state.message}
                            </pre>
                        ) : null}
                    </div>
                ) : null}
                {children}
            </div>
        );
    }
);
