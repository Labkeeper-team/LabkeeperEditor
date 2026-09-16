import { ReactNode } from 'react';
import { MathJax3Config, MathJaxContext } from 'better-react-mathjax';

// MathJax в браузере один, настройки ему даёт контекст, смонтированный первым.
// Поэтому у результата и у чата они общие, иначе всё решал бы порядок открытия
const MATHJAX_CONFIG: MathJax3Config = {
    loader: {
        load: ['input/asciimath', '[tex]/ams', 'output/chtml', 'ui/menu'],
    },
    options: {
        ignoreHtmlClass: 'cm-line',
        skipTags: ['div', 'p'],
    },
    asciimath: { displayMode: true, displaystyle: true },
    TeX: { MAXBUFFER: 25600 },
    tex: {
        inlineMath: [['$', '$']],
        maxBuffer: 25000,
        packages: { '[+]': ['ams'] },
    },
    CommonHTML: {
        automatic: false,
        scale: 10,
    },
};

export const AppMathJaxContext = ({ children }: { children: ReactNode }) => (
    <MathJaxContext
        src="/mathjax/tex-mml-chtml.js"
        config={MATHJAX_CONFIG}
        version={3}
    >
        {children}
    </MathJaxContext>
);
