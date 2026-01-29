import { useSelector } from 'react-redux';
import { StorageState } from '../../../../store';
import * as pdfjs from 'pdfjs-dist';
import { Util } from 'pdfjs-dist';
import { useEffect, useRef, useState } from 'react';

import './style.scss';
import 'pdfjs-dist/web/pdf_viewer.css';
import { useDictionary } from '../../../../store/selectors/translations';
import { Typography } from '../../../../components/typography';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
).toString();

type TextItem = { str: string; x: number; y: number; w: number; h: number };

export const PdfResultViewer = () => {
    const pdfUri = useSelector((state: StorageState) => state.project.pdfUri);
    const dictionary = useSelector(useDictionary);

    const containerRef = useRef<HTMLDivElement>(null);
    const pdfRef = useRef<pdfjs.PDFDocumentProxy | null>(null);

    const activeIndex = useSelector(
        (state: StorageState) => state.ide.activeSegmentIndex
    );

    const scrollTopRef = useRef<number>(0);
    const scaledRef = useRef<number>(1);
    const isRestoringRef = useRef<boolean>(true);

    const [pageElements, setPageElements] = useState<HTMLDivElement[]>([]);
    const pageTextItems = useRef<TextItem[][]>([]);

    // Selection state
    const isSelectingRef = useRef(false);
    const selectionStartRef = useRef<{ page: number; y: number } | null>(null);
    const selectedTextRef = useRef('');

    // =========================
    // Scroll tracking
    // =========================
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const onScroll = () => {
            if (isRestoringRef.current) return;
            scrollTopRef.current = container.scrollTop;
        };

        container.addEventListener('scroll', onScroll);
        return () => container.removeEventListener('scroll', onScroll);
    }, []);

    // =========================
    // Load PDF
    // =========================
    useEffect(() => {
        let lastDpr = window.devicePixelRatio;
        let cancelled = false;
        isRestoringRef.current = true;

        const loadPdf = async () => {
            if (!pdfUri || !containerRef.current) return;
            const dpr = window.devicePixelRatio || 1;
            const pdf = await pdfjs.getDocument(pdfUri).promise;
            if (cancelled) return;

            const scrollbarWidth = 8;
            const containerWidth = containerRef.current!.clientWidth - scrollbarWidth;

            const firstPage = await pdf.getPage(1);
            const unscaledViewport = firstPage.getViewport({ scale: 1 });
            const scale = containerWidth / unscaledViewport.width;

            pdfRef.current = pdf;
            containerRef.current!.innerHTML = '';
            pageTextItems.current = [];
            const pages: HTMLDivElement[] = [];

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale });
                const scaledViewport = page.getViewport({ scale: scale * dpr });
                scaledRef.current = scale * dpr;

                const wrapper = document.createElement('div');
                wrapper.style.position = 'relative';
                wrapper.style.width = `${viewport.width}px`;
                wrapper.style.height = `${viewport.height}px`;
                wrapper.style.marginBottom = '4px';
                wrapper.style.background = '#fff';
                wrapper.style.borderRadius = '4px';
                wrapper.style.boxShadow = '0 1px 4px rgba(0,0,0,0.1)';

                const canvas = document.createElement('canvas');
                canvas.width = scaledViewport.width;
                canvas.height = scaledViewport.height;
                canvas.style.width = `${viewport.width}px`;
                canvas.style.height = `${viewport.height}px`;
                wrapper.appendChild(canvas);

                // ===== overlay для подсветки =====
                const overlay = document.createElement('div');
                overlay.style.position = 'absolute';
                overlay.style.left = '0';
                overlay.style.top = '0';
                overlay.style.width = `${viewport.width}px`;
                overlay.style.height = `${viewport.height}px`;
                overlay.style.pointerEvents = 'none'; // чтобы мышь проходила к wrapper
                wrapper.appendChild(overlay);

                containerRef.current!.appendChild(wrapper);
                pages.push(wrapper);

                await page.render({ canvas, viewport: scaledViewport }).promise;

                const textContent = await page.getTextContent();
                const items: TextItem[] = textContent.items.map((item: any) => {
                    const transform = Util.transform(viewport.transform, item.transform);
                    return {
                        str: item.str,
                        x: transform[4],
                        y: transform[5],
                        w: item.width * scale,
                        h: Math.hypot(transform[2], transform[3]),
                    };
                });
                pageTextItems.current.push(items);

                attachSelectionHandlers(wrapper, overlay, items, i - 1);
            }

            setPageElements(pages);
        };

        const onResize = () => {
            const currentDpr = window.devicePixelRatio;
            if (currentDpr !== lastDpr) {
                lastDpr = currentDpr;
                loadPdf();
            }
        };

        loadPdf();
        window.addEventListener('resize', onResize);

        return () => {
            window.removeEventListener('resize', onResize);
            cancelled = true;
        };
    }, [pdfUri]);

    useEffect(() => {
        if (activeIndex == null || !pdfRef.current || pageElements.length === 0)
            return;

        const scrollToSegment = async (activeIndex_: number) => {
            const pdf = pdfRef.current!;
            const dest = await pdf.getDestination(`segment${activeIndex_}`);
            if (!dest || !containerRef.current) return;
            const pageIndex = await pdf.getPageIndex(dest[0]);
            const offsetYPdf = typeof dest[3] === 'number' ? dest[3] : 0;

            const pageEl = pageElements[pageIndex];
            if (!pageEl) return;

            const currentPage = await pdf.getPage(pageIndex + 1);
            const unscaledViewport = currentPage.getViewport({ scale: scaledRef.current });
            const pageCSSHeight = pageEl.scrollHeight;
            const pagePdfHeight = unscaledViewport.viewBox[3];
            const scaleBetweenPdfAndCss = pageCSSHeight / pagePdfHeight;
            const offSetCSS = offsetYPdf * scaleBetweenPdfAndCss;
            const scrollTop = containerRef.current.scrollHeight -
            (pdf.numPages - (pageIndex + 1)) * pageCSSHeight -
            offSetCSS;

            scrollTopRef.current =scrollTop;
            isRestoringRef.current = true;
            containerRef.current.scrollTo({
                top:
                    containerRef.current.scrollHeight -
                    (pdf.numPages - (pageIndex + 1)) * pageCSSHeight -
                    offSetCSS,
                behavior: 'smooth',
            });

            requestAnimationFrame(() => (isRestoringRef.current = false));
        };

        scrollToSegment(activeIndex);
    }, [activeIndex, pageElements]);

    // =========================
    // Attach selection handlers с подсветкой
    // =========================
    const attachSelectionHandlers = (
        wrapper: HTMLDivElement,
        overlay: HTMLDivElement,
        items: TextItem[],
        pageIndex: number
    ) => {
        wrapper.addEventListener('mousedown', (e) => {
            isSelectingRef.current = true;
            selectionStartRef.current = { page: pageIndex, y: e.offsetY };
            selectedTextRef.current = '';
            overlay.innerHTML = '';
        });

        wrapper.addEventListener('mousemove', (e) => {
            if (!isSelectingRef.current || !selectionStartRef.current) return;
            if (selectionStartRef.current.page !== pageIndex) return;

            const y1 = Math.min(selectionStartRef.current.y, e.offsetY);
            const y2 = Math.max(selectionStartRef.current.y, e.offsetY);

            overlay.innerHTML = '';
            const selected: string[] = [];

            for (const item of items) {
                if (item.y >= y1 && item.y <= y2) {
                    selected.push(item.str);

                    const highlight = document.createElement('div');
                    highlight.style.position = 'absolute';
                    highlight.style.left = `${item.x}px`;
                    highlight.style.top = `${item.y - item.h}px`;
                    highlight.style.width = `${item.w}px`;
                    highlight.style.height = `${item.h}px`;
                    highlight.style.background = 'rgba(0,120,215,0.35)';
                    overlay.appendChild(highlight);
                }
            }
            selectedTextRef.current = selected.join(' ');
        });

        wrapper.addEventListener('mouseup', () => {
            isSelectingRef.current = false;
            selectionStartRef.current = null;
        });
    };

    // =========================
    // Copy to clipboard
    // =========================
    useEffect(() => {
        const onCopy = (e: ClipboardEvent) => {
            if (!selectedTextRef.current) return;
            e.preventDefault();
            e.clipboardData?.setData('text/plain', selectedTextRef.current);
        };
        window.addEventListener('copy', onCopy);
        return () => window.removeEventListener('copy', onCopy);
    }, []);

    return (
        <div
            style={{
                flex: 1,
                overflow: 'hidden',
                display: !pdfUri ? 'initial' : 'flex',
                background: 'gray',
            }}
        >
            {!pdfUri ? (
                <div
                    style={{
                        display: 'flex',
                        flex: 1,
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: '100%',
                        width: '100%',
                    }}
                >
                    <Typography text={dictionary.viewer.no_pdf} />
                </div>
            ) : null}
            <div
                ref={containerRef}
                style={{
                    overflow: 'auto',
                    height: '100%',
                    width: '100%',
                    userSelect: 'none',
                }}
            />
        </div>
    );
};
