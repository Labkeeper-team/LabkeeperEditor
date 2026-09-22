import { memo, useState } from 'react';
import Markdown, { type Components, type ExtraProps } from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { MathJax } from 'better-react-mathjax';
import { AppMathJaxContext } from '../../../../components/mathJaxContext';
import { useMathJaxStatus } from '../../../../components/mathJaxContext/appMathJax.ts';
import { normalizeMathDelimiters } from '../../../../utils/mathDelimiters.ts';
import { agentTex } from '../../../../utils/agentTex.ts';

const hasClass = (className: unknown, name: string) =>
    (Array.isArray(className)
        ? className
        : String(className ?? '').split(' ')
    ).includes(name);

// формулы только из долларов: ```math без них не смонтировал бы контекст MathJax
const isMathBlock = (node: ExtraProps['node']) => {
    const child = node?.children[0];
    const text = child?.type === 'element' ? child.children[0] : undefined;
    return (
        child?.type === 'element' &&
        hasClass(child.properties.className, 'math-display') &&
        text?.type === 'text' &&
        agentTex(text.value) !== null
    );
};

// формула прячется до набора, но если MathJax не пришёл, видна текстом, пока он не появится
const AgentFormula = ({ tex, inline }: { tex: string; inline: boolean }) => {
    const status = useMathJaxStatus();
    const unavailable = status === 'failed' || status === 'waiting-online';
    // библиотека открывает формулу только в первом наборе, поэтому показанную текстом больше не прячем, иначе она пропадёт
    const [shownAsText, setShownAsText] = useState(false);
    if (unavailable && !shownAsText) {
        setShownAsText(true);
    }
    const hide = unavailable || shownAsText ? undefined : 'first';
    return inline ? (
        <MathJax inline hideUntilTypeset={hide}>
            {`$${tex}$`}
        </MathJax>
    ) : (
        <MathJax hideUntilTypeset={hide}>{`$$${tex}$$`}</MathJax>
    );
};

// без rehype-raw: текст агента можно подтолкнуть через проект, поэтому HTML остаётся текстом
const COMPONENTS: Components = {
    // ссылка не должна уводить со страницы, где идёт работа над проектом
    a: ({ href, children }) => (
        <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
        </a>
    ),
    // картинку не грузим: браузер сам сходил бы по адресу, который выбрал агент
    img: ({ src, alt }) => (
        <a href={src} target="_blank" rel="noopener noreferrer">
            {alt || src}
        </a>
    ),
    code: ({ className, children }) => {
        const inline = hasClass(className, 'math-inline');
        const tex =
            inline || hasClass(className, 'math-display')
                ? agentTex(String(children))
                : null;
        if (tex === null) {
            return <code className={className}>{children}</code>;
        }
        return <AgentFormula tex={tex} inline={inline} />;
    },
    // формуле-блоку не нужна подложка кода
    pre: ({ node, children }) =>
        isMathBlock(node) ? (
            <div className="agent-chat__math-block">{children}</div>
        ) : (
            <pre>{children}</pre>
        ),
};

const REMARK_PLUGINS = [remarkGfm, remarkBreaks, remarkMath];

export const AgentMarkdown = memo(({ text }: { text: string }) => {
    const source = normalizeMathDelimiters(text);
    const markdown = (
        <Markdown remarkPlugins={REMARK_PLUGINS} components={COMPONENTS}>
            {source}
        </Markdown>
    );
    // MathJax тяжёлый, грузим его только ради ответа, где могут быть формулы
    return source.includes('$') ? (
        <AppMathJaxContext>{markdown}</AppMathJaxContext>
    ) : (
        markdown
    );
});
