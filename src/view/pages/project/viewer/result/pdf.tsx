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

export const PdfResultViewer = () => {
    const pdfUri = useSelector((state: StorageState) => state.project.pdfUri);
    const dictionary = useSelector(useDictionary);

    const containerRef = useRef<HTMLDivElement>(null);
    const pdfRef = useRef<pdfjs.PDFDocumentProxy | null>(null);

    const activeIndex = useSelector(
        (state: StorageState) => state.ide.activeSegmentIndex
    );

    const scrollTopRef = useRef<number>(0);
    const lastScrollTopRef = useRef<number>(0);
    const scaledRef = useRef<number>(1);
    const isRestoringRef = useRef<boolean>(true);

    const [isPdfLoadingError, setIsPdfLoadingError] = useState<boolean>(false);
    const [pageElements, setPageElements] = useState<HTMLDivElement[]>([]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const onScroll = () => {
        const container = containerRef.current;
        if (!container) return;
        if (isRestoringRef.current) return;
        lastScrollTopRef.current = scrollTopRef.current;
        scrollTopRef.current = container.scrollTop;
    };
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        container.addEventListener('scroll', onScroll);
        return () => container.removeEventListener('scroll', onScroll);
    }, [onScroll]);

    useEffect(() => {
        let lastDpr = window.devicePixelRatio;
        let cancelled = false;
        isRestoringRef.current = true;

        const loadPdf = async () => {
            if (!pdfUri) {
                setIsPdfLoadingError(false);
                return;
            }
            try {
                const dpr = window.devicePixelRatio || 1;
                const pdf = await pdfjs.getDocument(pdfUri).promise;
                if (cancelled) return;

                const scrollbarWidth = 8;
                const containerWidth =
                    containerRef.current!.clientWidth - scrollbarWidth;

                const firstPage = await pdf.getPage(1);
                const unscaledViewport = firstPage.getViewport({ scale: 1 });

                const scale = containerWidth / unscaledViewport.width;
                pdfRef.current = pdf;
                containerRef.current!.innerHTML = '';

                const pages: HTMLDivElement[] = [];

                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);

                    const viewport = page.getViewport({ scale });
                    const scaledViewport = page.getViewport({
                        scale: scale * dpr,
                    });
                    scaledRef.current = scale * dpr;
                    // ===== page wrapper =====
                    const wrapper = document.createElement('div');
                    wrapper.style.position = 'relative';
                    wrapper.style.width = `${viewport.width}px`;
                    wrapper.style.height = `${viewport.height}px`;
                    wrapper.style.position = 'relative';
                    wrapper.style.marginBottom = '4px';
                    wrapper.style.background = '#fff';
                    wrapper.style.borderRadius = '4px';
                    wrapper.style.boxShadow = '0 1px 4px rgba(0,0,0,0.1)';

                    // ===== canvas =====
                    const canvas = document.createElement('canvas');
                    canvas.width = scaledViewport.width;
                    canvas.height = scaledViewport.height;
                    canvas.style.width = `${viewport.width}px`;
                    canvas.style.height = `${viewport.height}px`;
                    wrapper.appendChild(canvas);

                    // ===== text layer =====
                    const textLayer = document.createElement('div');
                    textLayer.className = 'textLayer';
                    textLayer.style.position = 'absolute';
                    textLayer.style.left = '0';
                    textLayer.style.top = '0';
                    textLayer.style.width = `${viewport.width}px`;
                    textLayer.style.height = `${viewport.height}px`;
                    wrapper.appendChild(textLayer);

                    containerRef.current?.appendChild(wrapper);
                    pages.push(wrapper);

                    // render canvas
                    await page.render({
                        canvas,
                        viewport: scaledViewport,
                    }).promise;

                    const textViewport = page.getViewport({ scale });
                    const textContent = await page.getTextContent();
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    textContent.items.forEach((item: any) => {
                        const transform = Util.transform(
                            textViewport.transform,
                            item.transform
                        );
                        const span = document.createElement('span');
                        span.textContent = item.str;

                        span.style.position = 'absolute';
                        const [a, b, c, d, e, f] = transform;
                        span.style.transform = `matrix(${a}, ${b}, ${c}, ${d - 2}, ${e}, ${f + 2})`;
                        span.style.transformOrigin = '0 0';
                        span.style.fontSize = '1px';
                        span.style.whiteSpace = 'pre';
                        span.style.color = 'transparent';

                        textLayer.appendChild(span);

                        const measuredWidth =
                            span.getBoundingClientRect().width;
                        if (measuredWidth > 0) {
                            const scaleX = (item.width * scale) / measuredWidth;
                            span.style.transform += ` scaleX(${scaleX})`;
                        }
                    });
                }

                requestAnimationFrame(() => {
                    if (containerRef?.current) {
                        scrollTopRef.current = lastScrollTopRef.current;
                        containerRef.current.scrollTop =
                            lastScrollTopRef.current;
                    }
                });
                setIsPdfLoadingError(false);
                setPageElements(pages);
                isRestoringRef.current = false;
            } catch (e) {
                console.log(e);
                setIsPdfLoadingError(true);
            }
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
            const destinationIndex = `segment${activeIndex_}`;
            const dest = await pdf.getDestination(destinationIndex);
            if (!dest || !containerRef.current) return;
            const pageIndex = await pdf.getPageIndex(dest[0]);
            const offsetYPdf = typeof dest[3] === 'number' ? dest[3] : 0;

            const pageEl = pageElements[pageIndex];
            if (!pageEl) return;

            const currentPage = await pdf.getPage(pageIndex + 1);
            const unscaledViewport = currentPage.getViewport({
                scale: scaledRef.current,
            });
            const pageCSSHeight = pageEl.scrollHeight;
            const pagePdfHeight = unscaledViewport.viewBox[3];
            const scaleBetweenPdfAndCss = pageCSSHeight / pagePdfHeight;
            const offSetCSS = offsetYPdf * scaleBetweenPdfAndCss;
            const scrollTop =
                containerRef.current.scrollHeight -
                (pdf.numPages - (pageIndex + 1)) * pageCSSHeight -
                offSetCSS;
            containerRef.current.scrollTo({
                top: scrollTop,
                behavior: 'smooth',
            });
            scrollTopRef.current = scrollTop;
        };
        scrollToSegment(activeIndex);
    }, [activeIndex, pageElements]);
    const showHelpText = !pdfUri || isPdfLoadingError;
    return (
        <div
            style={{
                flex: 1,
                overflow: 'hidden',
                display: showHelpText ? 'initial' : 'flex',
                background: 'gray',
            }}
        >
            {showHelpText ? (
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
                }}
            />
        </div>
    );
};
