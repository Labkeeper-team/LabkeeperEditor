import type { Plugin } from 'vite';

type Node = { type: string; start: number; end: number };

const STATIC_BLOCK = /\bstatic\s*\{/;

const collectStaticBlocks = (root: unknown): Node[] => {
    const found: Node[] = [];
    const stack: unknown[] = [root];
    while (stack.length) {
        const value = stack.pop();
        if (!value || typeof value !== 'object') {
            continue;
        }
        if (Array.isArray(value)) {
            stack.push(...value);
            continue;
        }
        const node = value as Node;
        if (node.type === 'StaticBlock') {
            found.push(node);
        }
        for (const child of Object.values(node)) {
            if (child && typeof child === 'object') {
                stack.push(child);
            }
        }
    }
    return found;
};

/**
 * static-блоки классов Chrome понимает с 94-й версии, а к нам ходят и с 86-й:
 * pdf.js держит такой блок в классе воркера, и старый Chrome не разбирал весь
 * чанк страницы проекта. Блок переписывается в приватное статическое поле с
 * немедленным вызовом стрелки, как это делает Babel: this, приватные члены и
 * порядок инициализации остаются прежними
 *
 * Свой плагин, а не build.target: с целью ниже 94-й Oxc вместе с блоками
 * переводит на WeakMap все приватные поля, и pdf.js медленнее у всех
 */
export const lowerClassStaticBlocks = (): Plugin => {
    let counter = 0;
    return {
        name: 'labkeeper:lower-class-static-blocks',
        apply: 'build',
        enforce: 'post',
        transform(code) {
            if (!STATIC_BLOCK.test(code)) {
                return null;
            }
            const blocks = collectStaticBlocks(this.parse(code));
            if (!blocks.length) {
                return null;
            }
            let result = code;
            const applied: { start: number; delta: number }[] = [];
            // с конца, чтобы начала ещё не тронутых блоков не сдвигались
            for (const block of blocks.sort((a, b) => b.start - a.start)) {
                // вложенный блок уже переписан, и конец внешнего уехал на его разницу
                const end = applied
                    .filter(
                        (done) =>
                            done.start > block.start && done.start < block.end
                    )
                    .reduce((sum, done) => sum + done.delta, block.end);
                const open = result.indexOf('{', block.start);
                const body = result.slice(open + 1, end - 1);
                counter += 1;
                const lowered = `static #lkStaticBlock${counter} = (() => {${body}})();`;
                result = `${result.slice(0, block.start)}${lowered}${result.slice(end)}`;
                applied.push({
                    start: block.start,
                    delta: lowered.length - (end - block.start),
                });
            }
            // строки не сдвигаются, поэтому карту модуля не пересчитываем: колонки около блока уедут на несколько символов
            return { code: result, map: null };
        },
    };
};
