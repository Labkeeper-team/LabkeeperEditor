import { useSyncExternalStore } from 'react';
import type {
    MathJax3Config,
    MathJaxSubscriberProps,
} from 'better-react-mathjax';
import { createMathJaxLoader } from '../../utils/mathJaxLoader.ts';
import { reportToSentry } from '../../../viewModel/utils/reportUnexpectedError.ts';

// настройки у результата и у чата общие и собираются заново на каждую попытку: MathJax дописывает в конфиг своё
const createMathJaxConfig = (): MathJax3Config => ({
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
});

// загрузку ведём сами: у MathJaxContext один оборванный запрос навсегда отклоняет обещание, и каждая формула бросает ошибку
export const mathJaxLoader = createMathJaxLoader({
    src: '/mathjax/tex-mml-chtml.js',
    createConfig: createMathJaxConfig,
    retryDelaysMs: [1000, 3000, 10000],
    startupTimeoutMs: 20000,
    restartIntervalMs: 60000,
    reportDelayMs: 1500,
    onLoadFailure: (error) => reportToSentry('mathjax-load-failed', error),
    onTypesetError: (error) => reportToSentry('mathjax-typeset-failed', error),
});

// значение одно на модуль: новый объект на каждый рендер провайдера перерисовывал бы все формулы
export const MATHJAX_CONTEXT_VALUE: MathJaxSubscriberProps = {
    version: 3,
    promise: mathJaxLoader.ready,
    renderMode: 'post',
};

/** Где сейчас загрузка MathJax: пока грузится, формулы можно прятать, после отказа показать текстом */
export const useMathJaxStatus = () =>
    useSyncExternalStore(mathJaxLoader.subscribe, mathJaxLoader.status);
