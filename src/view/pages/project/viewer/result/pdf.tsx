import { useSelector } from 'react-redux';
import { StorageState } from '../../../../store';
import * as pdfjs from 'pdfjs-dist';
import { Util } from 'pdfjs-dist';
import { useCallback, useEffect, useRef, useState } from 'react';

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
    /** После перезагрузки PDF не дергать scrollToSegment (конфликтует с восстановлением позиции). */
    const suppressNextSegmentScrollRef = useRef(false);
    const hadPdfPagesRef = useRef(false);
    /** Пользователь уже крутил документ после текущей загрузки — не перебивать отложенным programmatic scroll. */
    const userScrolledSincePdfLoadRef = useRef(false);
    const pdfLayoutGenRef = useRef(0);
    const activeIndexRef = useRef(activeIndex);
    const prevActiveIndexForScrollRef = useRef<number | undefined>(undefined);

    const [isPdfLoadingError, setIsPdfLoadingError] = useState<boolean>(false);
    const [isPdfRendering, setIsPdfRendering] = useState<boolean>(false);
    const [pageElements, setPageElements] = useState<HTMLDivElement[]>([]);
    /** Увеличивается после каждой успешной вёрстки PDF; без этого в deps ловили бы только смену activeIndex, а не «документ готов». */
    const [pdfLayoutGeneration, setPdfLayoutGeneration] = useState(0);
    const pageElementsRef = useRef<HTMLDivElement[]>([]);

    useEffect(() => {
        pageElementsRef.current = pageElements;
    }, [pageElements]);

    useEffect(() => {
        pdfLayoutGenRef.current = pdfLayoutGeneration;
    }, [pdfLayoutGeneration]);

    useEffect(() => {
        activeIndexRef.current = activeIndex;
    }, [activeIndex]);

    const runScrollToSegment = useCallback(
        async (
            activeIndex_: number,
            opts: { layoutGenAtStart?: number } = {}
        ) => {
            const pdf = pdfRef.current;
            const container = containerRef.current;
            const pages = pageElementsRef.current;
            if (!pdf || !container || pages.length === 0 || activeIndex_ < 0) {
                return;
            }

            const destinationIndex = `segment${activeIndex_}`;
            const dest = await pdf.getDestination(destinationIndex);
            if (!dest || !containerRef.current) return;
            const pageIndex = await pdf.getPageIndex(dest[0]);
            const offsetYPdf = typeof dest[3] === 'number' ? dest[3] : 0;

            const pageEl = pages[pageIndex];
            if (!pageEl) return;

            if (opts.layoutGenAtStart !== undefined) {
                if (opts.layoutGenAtStart !== pdfLayoutGenRef.current) return;
                if (userScrolledSincePdfLoadRef.current) return;
            }

            if (activeIndex_ !== activeIndexRef.current) return;

            const currentPage = await pdf.getPage(pageIndex + 1);
            if (!containerRef.current || pdfRef.current !== pdf) return;

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

            if (opts.layoutGenAtStart !== undefined) {
                if (opts.layoutGenAtStart !== pdfLayoutGenRef.current) return;
                if (userScrolledSincePdfLoadRef.current) return;
            }
            if (activeIndex_ !== activeIndexRef.current) return;

            containerRef.current.scrollTo({
                top: scrollTop,
                behavior:
                    opts.layoutGenAtStart !== undefined ? 'auto' : 'smooth',
            });
            scrollTopRef.current = scrollTop;
        },
        []
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const onScroll = () => {
        const container = containerRef.current;
        if (!container) return;
        if (isRestoringRef.current) return;
        userScrolledSincePdfLoadRef.current = true;
        lastScrollTopRef.current = scrollTopRef.current;
        scrollTopRef.current = container.scrollTop;
    };
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        container.addEventListener('scroll', onScroll);
        return () => container.removeEventListener('scroll', onScroll);
    }, [onScroll, isPdfLoadingError]);

    useEffect(() => {
        let lastDpr = window.devicePixelRatio;
        let cancelled = false;
        isRestoringRef.current = true;

        const loadPdf = async () => {
            if (!pdfUri) {
                setIsPdfRendering(false);
                setIsPdfLoadingError(false);
                hadPdfPagesRef.current = false;
                return;
            }
            setIsPdfRendering(true);
            /** Иначе после ошибки остаётся ветка без containerRef — loadPdf после await падает на innerHTML. */
            setIsPdfLoadingError(false);
            userScrolledSincePdfLoadRef.current = false;
            try {
                const dpr = window.devicePixelRatio || 1;
                const pdf = await pdfjs.getDocument(pdfUri).promise;
                if (cancelled) {
                    setIsPdfRendering(false);
                    return;
                }

                const container = containerRef.current;
                if (!container) {
                    setIsPdfRendering(false);
                    setIsPdfLoadingError(true);
                    return;
                }

                const scrollbarWidth = 8;
                const containerWidth =
                    (container.clientWidth ?? 0) - scrollbarWidth;

                const firstPage = await pdf.getPage(1);
                const unscaledViewport = firstPage.getViewport({ scale: 1 });

                const scale = containerWidth / unscaledViewport.width;
                pdfRef.current = pdf;
                const restoreScrollTop = lastScrollTopRef.current;
                const hideUntilScrolled = restoreScrollTop > 0;
                if (hideUntilScrolled) {
                    container.style.visibility = 'hidden';
                }
                container.innerHTML = '';

                const pages: HTMLDivElement[] = [];
                const scaledCss = scale * dpr;
                scaledRef.current = scaledCss;

                /** Сначала все обёртки с финальной высотой — иначе scrollHeight растёт по мере рендера и ползунок «плавает». */
                type PageSlot = {
                    page: pdfjs.PDFPageProxy;
                    wrapper: HTMLDivElement;
                    viewport: pdfjs.PageViewport;
                    scaledViewport: pdfjs.PageViewport;
                };
                const slots: PageSlot[] = [];

                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    if (cancelled) {
                        container.style.visibility = '';
                        setIsPdfRendering(false);
                        return;
                    }

                    const viewport = page.getViewport({ scale });
                    const scaledViewport = page.getViewport({
                        scale: scaledCss,
                    });

                    const wrapper = document.createElement('div');
                    wrapper.style.position = 'relative';
                    wrapper.style.width = `${viewport.width}px`;
                    wrapper.style.height = `${viewport.height}px`;
                    wrapper.style.marginBottom = '4px';
                    wrapper.style.background = '#fff';
                    wrapper.style.borderRadius = '4px';
                    wrapper.style.boxShadow = '0 1px 4px rgba(0,0,0,0.1)';

                    container.appendChild(wrapper);
                    pages.push(wrapper);
                    slots.push({ page, wrapper, viewport, scaledViewport });
                }

                for (const {
                    page,
                    wrapper,
                    viewport,
                    scaledViewport,
                } of slots) {
                    if (cancelled) {
                        container.style.visibility = '';
                        setIsPdfRendering(false);
                        return;
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = scaledViewport.width;
                    canvas.height = scaledViewport.height;
                    canvas.style.width = `${viewport.width}px`;
                    canvas.style.height = `${viewport.height}px`;
                    wrapper.appendChild(canvas);

                    const textLayer = document.createElement('div');
                    textLayer.className = 'textLayer';
                    textLayer.style.position = 'absolute';
                    textLayer.style.left = '0';
                    textLayer.style.top = '0';
                    textLayer.style.width = `${viewport.width}px`;
                    textLayer.style.height = `${viewport.height}px`;
                    wrapper.appendChild(textLayer);

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

                if (cancelled) {
                    container.style.visibility = '';
                    setIsPdfRendering(false);
                    return;
                }

                const maxScroll = Math.max(
                    0,
                    container.scrollHeight - container.clientHeight
                );
                const clampedScroll = Math.min(restoreScrollTop, maxScroll);
                container.scrollTop = clampedScroll;
                scrollTopRef.current = clampedScroll;

                if (hadPdfPagesRef.current) {
                    suppressNextSegmentScrollRef.current = true;
                }
                hadPdfPagesRef.current = true;

                setIsPdfLoadingError(false);
                setPageElements(pages);
                setPdfLayoutGeneration((g) => g + 1);

                const finishRestore = () => {
                    if (cancelled) return;
                    isRestoringRef.current = false;
                    setIsPdfRendering(false);
                };

                if (hideUntilScrolled) {
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            if (cancelled || !containerRef.current) return;
                            containerRef.current.style.visibility = '';
                            finishRestore();
                        });
                    });
                } else {
                    finishRestore();
                }
            } catch (e) {
                console.log(e);
                if (containerRef.current) {
                    containerRef.current.style.visibility = '';
                }
                isRestoringRef.current = false;
                setIsPdfRendering(false);
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
            setIsPdfRendering(false);
        };
    }, [pdfUri]);

    /** Только новая вёрстка PDF: подскролл к активному сегменту, без повторов при тех же deps. */
    useEffect(() => {
        if (pdfLayoutGeneration === 0) return;

        if (suppressNextSegmentScrollRef.current) {
            suppressNextSegmentScrollRef.current = false;
            return;
        }

        const idx = activeIndexRef.current;
        if (
            idx < 0 ||
            !pdfRef.current ||
            pageElementsRef.current.length === 0
        ) {
            return;
        }

        const genAtStart = pdfLayoutGeneration;
        void runScrollToSegment(idx, { layoutGenAtStart: genAtStart });
    }, [pdfLayoutGeneration, runScrollToSegment]);

    /** Смена активного сегмента в IDE — скроллим PDF к нему (не то же самое, что перерисовка страниц). */
    useEffect(() => {
        const prev = prevActiveIndexForScrollRef.current;
        prevActiveIndexForScrollRef.current = activeIndex;

        if (prev === undefined) return;
        if (prev === activeIndex) return;
        if (
            activeIndex < 0 ||
            !pdfRef.current ||
            pageElementsRef.current.length === 0
        ) {
            return;
        }

        void runScrollToSegment(activeIndex);
    }, [activeIndex, runScrollToSegment]);
    const showHelpText = !pdfUri || isPdfLoadingError;
    const showPdfLoading = Boolean(
        pdfUri && !isPdfLoadingError && isPdfRendering
    );
    return (
        <div
            style={{
                flex: 1,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
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
            ) : (
                <>
                    {showPdfLoading ? (
                        <div
                            style={{
                                position: 'absolute',
                                inset: 0,
                                zIndex: 1,
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                pointerEvents: 'auto',
                                touchAction: 'none',
                            }}
                        >
                            <Typography text={dictionary.viewer.pdf_loading} />
                        </div>
                    ) : null}
                    <div
                        ref={containerRef}
                        style={{
                            overflow: 'auto',
                            height: '100%',
                            width: '100%',
                            flex: 1,
                            minHeight: 0,
                        }}
                    />
                </>
            )}
        </div>
    );
};
