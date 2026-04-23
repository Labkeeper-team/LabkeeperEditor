import { ViewPlugin, type ViewUpdate } from '@codemirror/view';

/** Должно совпадать с `$segment-editor-rules-right-gutter` в `style.scss`. */
const SEGMENT_EDITOR_RULES_RIGHT_GUTTER_PX = 160;

/**
 * CodeMirror 6 в `rectanglesForRange` берёт padding справа только у первой `.cm-line`
 * и вычитает его из `rightSide` для всего выделения — при неравном padding по строкам
 * заливка на 2+ строках обрезается. Подправляем ширину только у самых правых
 * `.cm-selectionBackground` в каждой горизонтальной полосе, если до края `.cm-content` есть зазор.
 */
export function segmentEditorSelectionGutterFix() {
    return ViewPlugin.define((view) => {
        let raf = 0;

        const patch = () => {
            raf = 0;
            if (!view.dom.ownerDocument?.contains(view.dom)) {
                return;
            }
            const layer = view.scrollDOM.querySelector('.cm-selectionLayer');
            const content = view.contentDOM;
            if (!layer || !content) {
                return;
            }
            const contentRight = content.getBoundingClientRect().right;
            const sx = view.scaleX || 1;
            const nodes = layer.querySelectorAll('.cm-selectionBackground');
            if (nodes.length === 0) {
                return;
            }

            type Entry = { el: HTMLElement; right: number; midY: number };
            const entries: Entry[] = [];
            for (let i = 0; i < nodes.length; i++) {
                const el = nodes[i] as HTMLElement;
                const r = el.getBoundingClientRect();
                entries.push({
                    el,
                    right: r.right,
                    midY: (r.top + r.bottom) / 2,
                });
            }

            const band = Math.max(4, view.defaultLineHeight / 4);
            const byBand = new Map<number, Entry[]>();
            for (const e of entries) {
                const k = Math.round(e.midY / band);
                let list = byBand.get(k);
                if (!list) {
                    list = [];
                    byBand.set(k, list);
                }
                list.push(e);
            }
            // Фикс нужен только для многострочного (многополосного) выделения.
            // Иначе при выделении одного слова можно визуально «растянуть» заливку.
            if (byBand.size < 2) {
                return;
            }

            for (const list of byBand.values()) {
                const maxRight = Math.max(...list.map((e) => e.right));
                for (const { el, right } of list) {
                    if (right < maxRight - 0.5) {
                        continue;
                    }
                    const gap = contentRight - right;
                    if (gap <= 0.5) {
                        continue;
                    }
                    const w = parseFloat(el.style.width);
                    if (!Number.isFinite(w) || w <= 0) {
                        continue;
                    }
                    const maxExtend =
                        (SEGMENT_EDITOR_RULES_RIGHT_GUTTER_PX + 24) / sx;
                    // Корректируем только случаи с типичным «обрезанием» справа.
                    // Если зазор намного больше правого gutter, это обычное короткое выделение.
                    if (gap / sx > maxExtend + 1) {
                        continue;
                    }
                    const add = Math.min(gap / sx, maxExtend);
                    el.style.width = `${w + add}px`;
                }
            }
        };

        const schedule = () => {
            if (raf !== 0) {
                return;
            }
            raf = requestAnimationFrame(patch);
        };

        schedule();

        return {
            update(u: ViewUpdate) {
                if (
                    u.selectionSet ||
                    u.geometryChanged ||
                    u.viewportChanged ||
                    u.docChanged
                ) {
                    schedule();
                }
            },
            destroy() {
                if (raf !== 0) {
                    cancelAnimationFrame(raf);
                }
            },
        };
    });
}
