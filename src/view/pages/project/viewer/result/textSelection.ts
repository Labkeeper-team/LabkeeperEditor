import { normalizeUnicode } from 'pdfjs-dist/legacy/build/pdf.mjs';

/** Класс на <html>, пока мышь или палец тянут выделение из PDF: остальной интерфейс на это время не выделяется */
const PDF_TEXT_SELECTING_CLASS = 'pdf-text-selecting';

/** Выделение в текстовых слоях PDF по образцу TextLayerBuilder из pdfjs-dist/web/pdf_viewer.mjs (Apache-2.0): без этой логики протяжка в пустое место прыгает к началу или концу страницы; сверять с #bindMouse и #enableGlobalSelectionListener при обновлении pdfjs-dist */
export class PdfTextSelection {
    // текстовый слой и его endOfContent
    private layers = new Map<HTMLElement, HTMLElement>();
    private abort: AbortController | null = null;

    add(textLayer: HTMLElement) {
        const end = document.createElement('div');
        end.className = 'endOfContent';
        textLayer.append(end);
        textLayer.addEventListener('mousedown', () => {
            textLayer.classList.add('selecting');
        });
        textLayer.addEventListener('pointerdown', (event) => {
            // выделение тянет только основная кнопка, а после меню правой кнопки pointerup может не прийти
            if (event.button === 0) {
                document.documentElement.classList.add(
                    PDF_TEXT_SELECTING_CLASS
                );
            }
        });
        this.layers.set(textLayer, end);
        this.listen();
    }

    /** Слои перерисованы или просмотрщик ушёл со страницы: забыть их и снять общие обработчики */
    clear() {
        this.layers.clear();
        this.abort?.abort();
        this.abort = null;
        document.documentElement.classList.remove(PDF_TEXT_SELECTING_CLASS);
    }

    private reset = (end: HTMLElement, textLayer: HTMLElement) => {
        // сброс идёт по всем страницам на каждый selectionchange и keyup, в том числе при вводе в редакторе, а у сброшенного слоя трогать нечего
        if (
            textLayer.lastChild === end &&
            !end.style.width &&
            !end.style.height &&
            !textLayer.classList.contains('selecting')
        ) {
            return;
        }
        textLayer.append(end);
        end.style.width = '';
        end.style.height = '';
        textLayer.classList.remove('selecting');
    };

    private resetAll = () => {
        this.layers.forEach(this.reset);
        document.documentElement.classList.remove(PDF_TEXT_SELECTING_CLASS);
    };

    private isInLayers(node: Node | null) {
        const element = node instanceof Element ? node : node?.parentElement;
        const textLayer = element?.closest('.textLayer');
        return textLayer instanceof HTMLElement && this.layers.has(textLayer);
    }

    private listen() {
        if (this.abort) {
            return;
        }
        this.abort = new AbortController();
        const { signal } = this.abort;
        let isPointerDown = false;
        document.addEventListener(
            'pointerdown',
            () => {
                isPointerDown = true;
            },
            { signal }
        );
        document.addEventListener(
            'pointerup',
            () => {
                isPointerDown = false;
                this.resetAll();
            },
            { signal }
        );
        // прокрутка пальцем отменяет указатель без pointerup
        document.addEventListener(
            'pointercancel',
            () => {
                isPointerDown = false;
                document.documentElement.classList.remove(
                    PDF_TEXT_SELECTING_CLASS
                );
            },
            { signal }
        );
        // меню по правой кнопке или Ctrl+клику на macOS забирает указатель, и pointerup может не прийти
        document.addEventListener(
            'contextmenu',
            () => {
                isPointerDown = false;
                this.resetAll();
            },
            { signal }
        );
        window.addEventListener(
            'blur',
            () => {
                isPointerDown = false;
                this.resetAll();
            },
            { signal }
        );
        document.addEventListener(
            'keyup',
            () => {
                if (!isPointerDown) {
                    this.resetAll();
                }
            },
            { signal }
        );
        // в буфер только текст, как в pdf.js: HTML прозрачных span при вставке дал бы невидимый текст
        document.addEventListener(
            'copy',
            (event) => {
                const selection = document.getSelection();
                if (
                    !selection ||
                    selection.isCollapsed ||
                    !event.clipboardData ||
                    !this.isInLayers(selection.anchorNode) ||
                    !this.isInLayers(selection.focusNode)
                ) {
                    return;
                }
                event.clipboardData.setData(
                    'text/plain',
                    normalizeUnicode(selection.toString()).replaceAll(
                        '\x00',
                        ''
                    )
                );
                event.preventDefault();
            },
            { signal }
        );
        let isFirefox: boolean | undefined;
        let prevRange: Range | undefined;
        document.addEventListener(
            'selectionchange',
            () => {
                const selection = document.getSelection();
                if (!selection || selection.rangeCount === 0) {
                    this.layers.forEach(this.reset);
                    return;
                }
                const activeTextLayers = new Set<HTMLElement>();
                for (let i = 0; i < selection.rangeCount; i++) {
                    const range = selection.getRangeAt(i);
                    for (const textLayer of this.layers.keys()) {
                        if (range.intersectsNode(textLayer)) {
                            activeTextLayers.add(textLayer);
                        }
                    }
                }
                for (const [textLayer, end] of this.layers) {
                    if (activeTextLayers.has(textLayer)) {
                        textLayer.classList.add('selecting');
                    } else {
                        this.reset(end, textLayer);
                    }
                }
                const firstEnd = this.layers.values().next().value;
                if (!firstEnd) {
                    return;
                }
                // Firefox сам держит выделение в границах, признак берём у endOfContent, как pdf.js
                isFirefox ??=
                    getComputedStyle(firstEnd).getPropertyValue(
                        '-moz-user-select'
                    ) === 'none';
                if (isFirefox) {
                    return;
                }
                // endOfContent встаёт сразу за концом выделения и растягивается на слой, так пустое место не уводит выделение
                const range = selection.getRangeAt(0);
                const modifyStart =
                    prevRange &&
                    (range.compareBoundaryPoints(
                        Range.END_TO_END,
                        prevRange
                    ) === 0 ||
                        range.compareBoundaryPoints(
                            Range.START_TO_END,
                            prevRange
                        ) === 0);
                let anchor: Node | null = modifyStart
                    ? range.startContainer
                    : range.endContainer;
                if (anchor.nodeType === Node.TEXT_NODE) {
                    anchor = anchor.parentNode;
                }
                if (!modifyStart && range.endOffset === 0) {
                    do {
                        while (anchor && !anchor.previousSibling) {
                            anchor = anchor.parentNode;
                        }
                        anchor = anchor?.previousSibling ?? null;
                    } while (anchor && !anchor.childNodes.length);
                }
                const parentTextLayer = anchor?.parentElement?.closest(
                    '.textLayer'
                ) as HTMLElement | null | undefined;
                const end = parentTextLayer
                    ? this.layers.get(parentTextLayer)
                    : undefined;
                if (anchor && parentTextLayer && end) {
                    end.style.width = parentTextLayer.style.width;
                    end.style.height = parentTextLayer.style.height;
                    end.style.userSelect = 'text';
                    anchor.parentElement!.insertBefore(
                        end,
                        modifyStart ? anchor : anchor.nextSibling
                    );
                }
                prevRange = range.cloneRange();
            },
            { signal }
        );
    }
}
