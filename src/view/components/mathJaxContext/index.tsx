import { ReactNode, useEffect } from 'react';
import { MathJaxBaseContext } from 'better-react-mathjax';
import { MATHJAX_CONTEXT_VALUE, mathJaxLoader } from './appMathJax.ts';

export const AppMathJaxContext = ({ children }: { children: ReactNode }) => {
    // грузим с первым контекстом на странице, то есть только когда есть что набирать
    useEffect(() => mathJaxLoader.load(), []);
    return (
        <MathJaxBaseContext.Provider value={MATHJAX_CONTEXT_VALUE}>
            {children}
        </MathJaxBaseContext.Provider>
    );
};
