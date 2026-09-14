import { memo } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

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
};

// remark-math не рисует формулы, а не даёт markdown сделать курсив из звёздочек в $a*b*c$
const REMARK_PLUGINS = [remarkGfm, remarkBreaks, remarkMath];

export const AgentMarkdown = memo(({ text }: { text: string }) => (
    <Markdown remarkPlugins={REMARK_PLUGINS} components={COMPONENTS}>
        {text}
    </Markdown>
));
