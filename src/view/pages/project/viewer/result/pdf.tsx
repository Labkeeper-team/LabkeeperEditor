import { useDispatch, useSelector } from 'react-redux';
import { StorageState } from '../../../../store';
import * as pdfjs from 'pdfjs-dist';
import { Util } from 'pdfjs-dist';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PdfPosition } from '../../../../../model/rpi';
import {
    setPdfClickPosition,
    setPdfNavigationTarget,
} from '../../../../store/slices/ide';

import './style.scss';
import 'pdfjs-dist/web/pdf_viewer.css';
import { useDictionary } from '../../../../store/selectors/translations';
import { Typography } from '../../../../components/typography';
import { AppDispatch } from '../../../../store';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
).toString();

/** API/SyncTeX y is the line baseline; shift up in PDF pt, then scale to CSS px. */
const SYNCTEX_BASELINE_OFFSET_PT = 10;

/** Gap between rendered PDF pages (matches wrapper marginBottom). */
const PDF_PAGE_GAP_PX = 4;

export const PdfResultViewer = () => {
    const dispatch = useDispatch<AppDispatch>();
    const pdfUri = useSelector((state: StorageState) => state.project.pdfUri);
    const dictionary = useSelector(useDictionary);
    const pdfNavigationTarget = useSelector(
        (state: StorageState) => state.ide.pdfNavigationTarget
    );

    const containerRef = useRef<HTMLDivElement>(null);
    const pdfRef = useRef<pdfjs.PDFDocumentProxy | null>(null);
    const pdfDisplayScaleRef = useRef<number>(1);

    const scrollTopRef = useRef<number>(0);
    const lastScrollTopRef = useRef<number>(0);
    const isRestoringRef = useRef<boolean>(true);

    const [isPdfLoadingError, setIsPdfLoadingError] = useState<boolean>(false);
    const [isPdfRendering, setIsPdfRendering] = useState<boolean>(false);
    const [pageElements, setPageElements] = useState<HTMLDivElement[]>([]);
    const pageElementsRef = useRef<HTMLDivElement[]>([]);

    useEffect(() => {
        pageElementsRef.current = pageElements;
    }, [pageElements]);

    const scrollToPdfPosition = useCallback(
        async (position: PdfPosition): Promise<boolean> => {
            const pdf = pdfRef.current;
            const container = containerRef.current;
            const pages = pageElementsRef.current;
            if (!pdf || !container || pages.length === 0) {
                return false;
            }

            const pageIndex = position.page - 1;
            if (pageIndex < 0 || pageIndex >= pages.length) {
                return false;
            }

            const pageEl = pages[pageIndex];
            if (!pageEl.isConnected) {
                return false;
            }

            const currentPage = await pdf.getPage(position.page);
            if (!containerRef.current || pdfRef.current !== pdf) {
                return false;
            }

            await new Promise<void>((resolve) => {
                requestAnimationFrame(() => resolve());
            });

            const viewport = currentPage.getViewport({
                scale: pdfDisplayScaleRef.current,
            });
            const pageCSSHeight = pageEl.offsetHeight;
            if (pageCSSHeight <= 0) {
                return false;
            }

            const pdfPageHeight = viewport.viewBox[3] - viewport.viewBox[1];
            if (pdfPageHeight <= 0) {
                return false;
            }

            const scaleBetweenPdfAndCss = pageCSSHeight / pdfPageHeight;

            let pageTop = 0;
            for (let i = 0; i < pageIndex; i++) {
                pageTop += pages[i].offsetHeight + PDF_PAGE_GAP_PX;
            }

            const offsetFromTopOnPage =
                Math.max(0, position.y - SYNCTEX_BASELINE_OFFSET_PT) *
                scaleBetweenPdfAndCss;

            const scrollTop = Math.max(0, pageTop + offsetFromTopOnPage);

            containerRef.current.scrollTo({
                top: scrollTop,
                behavior: 'smooth',
            });
            scrollTopRef.current = scrollTop;
            return true;
        },
        []
    );

    /** Скролл после ответа API; повтор при появлении страниц PDF. */
    useEffect(() => {
        if (!pdfNavigationTarget || isPdfRendering) {
            return;
        }
        void (async () => {
            const ok = await scrollToPdfPosition(pdfNavigationTarget);
            if (ok) {
                dispatch(setPdfNavigationTarget(null));
            }
        })();
    }, [
        pdfNavigationTarget,
        scrollToPdfPosition,
        dispatch,
        pageElements.length,
        isPdfRendering,
    ]);

    const handlePdfClick = useCallback(
        (event: React.MouseEvent<HTMLDivElement>) => {
            const pages = pageElementsRef.current;
            const pdf = pdfRef.current;
            if (!pages.length || !pdf) {
                return;
            }

            const target = event.target;
            if (!(target instanceof Element)) {
                return;
            }

            const pageWrapper = target.closest('[data-pdf-page]');
            if (!(pageWrapper instanceof HTMLElement)) {
                return;
            }

            const pageIndex = Number(pageWrapper.dataset.pdfPage);
            if (!Number.isFinite(pageIndex) || pageIndex < 0) {
                return;
            }

            const rect = pageWrapper.getBoundingClientRect();
            const clickX = event.clientX - rect.left;
            const clickY = event.clientY - rect.top;

            void (async () => {
                const currentPage = await pdf.getPage(pageIndex + 1);
                const viewport = currentPage.getViewport({
                    scale: pdfDisplayScaleRef.current,
                });
                const pdfPageWidth = viewport.viewBox[2] - viewport.viewBox[0];
                const pdfPageHeight = viewport.viewBox[3] - viewport.viewBox[1];
                const x = Math.round(clickX * (pdfPageWidth / rect.width));
                const y = Math.round(clickY * (pdfPageHeight / rect.height));

                dispatch(
                    setPdfClickPosition({
                        page: pageIndex + 1,
                        x,
                        y,
                    })
                );
            })();
        },
        [dispatch]
    );

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
    }, [onScroll, isPdfLoadingError]);

    useEffect(() => {
        let lastDpr = window.devicePixelRatio;
        let cancelled = false;
        isRestoringRef.current = true;

        const loadPdf = async () => {
            if (!pdfUri) {
                setIsPdfRendering(false);
                setIsPdfLoadingError(false);
                return;
            }
            setIsPdfRendering(true);
            setIsPdfLoadingError(false);
            dispatch(setPdfClickPosition(null));
            try {
                const dpr = window.devicePixelRatio || 1;
                const pdf = await pdfjs.getDocument({
                    url: pdfUri,
                }).promise;
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
                pdfDisplayScaleRef.current = scale;
                pdfRef.current = pdf;
                const restoreScrollTop = lastScrollTopRef.current;
                const hideUntilScrolled = restoreScrollTop > 0;
                if (hideUntilScrolled) {
                    container.style.visibility = 'hidden';
                }
                container.innerHTML = '';

                const pages: HTMLDivElement[] = [];
                const scaledCss = scale * dpr;

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
                    wrapper.dataset.pdfPage = String(i - 1);
                    wrapper.style.position = 'relative';
                    wrapper.style.width = `${viewport.width}px`;
                    wrapper.style.height = `${viewport.height}px`;
                    wrapper.style.marginBottom = `${PDF_PAGE_GAP_PX}px`;
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

                setIsPdfLoadingError(false);
                setPageElements(pages);

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
    }, [pdfUri, dispatch]);

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
                        onClick={handlePdfClick}
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
