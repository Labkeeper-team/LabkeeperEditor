import { forwardRef } from 'react';
import { MathJaxContext } from 'better-react-mathjax';

import './style.scss';

import 'mathjax-full/js/input/tex/mathtools/MathtoolsConfiguration';
import 'mathjax-full/js/input/tex/AllPackages';

import { Segments } from './segments';
export const ViewResult = forwardRef((_, ref) => {
  return (
    <div
      ref={ref as any}
      id="compile-result"
      style={{ margin: 6, flex: 1, overflowX: 'hidden', overflowY: 'auto' }}
    >
      <MathJaxContext
        config={{
          loader: {
            load: ['input/asciimath', '[tex]/ams', 'output/chtml', 'ui/menu'],
          },
          options: {
            ignoreHtmlClass: 'cm-line',
            skipTags: ['div', 'p']
          },
          asciimath: { displayMode: true, displaystyle: true },
          TeX: {MAXBUFFER: 25600},
          tex: {
            inlineMath: [['$', '$']],
            maxBuffer: 25000,
            packages: { '[+]': ['ams'] },
          },
          CommonHTML: {
            automatic: false,
            scale: 10,
          },
        }}
        version={3}
      >
        <Segments />
      </MathJaxContext>
    </div>
  );
});
