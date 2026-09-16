import { ForwardedRef, forwardRef } from 'react';

import './style.scss';

import 'mathjax-full/js/input/tex/mathtools/MathtoolsConfiguration';
import 'mathjax-full/js/input/tex/AllPackages';

import { Segments } from './segments';
import { AppMathJaxContext } from '../../../../../components/mathJaxContext';
export const ViewResult = forwardRef((_, ref) => {
    return (
        <div
            ref={ref as ForwardedRef<HTMLDivElement>}
            id="compile-result"
            style={{
                margin: 6,
                flex: 1,
                overflowX: 'hidden',
                overflowY: 'auto',
            }}
        >
            <AppMathJaxContext>
                <Segments />
            </AppMathJaxContext>
        </div>
    );
});
