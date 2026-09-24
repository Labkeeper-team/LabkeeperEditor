import '../../../../utils/pdfjsCompatibility.ts';
import pdfjsWorkerSrc from '../../../../utils/pdfjsWorkerCompatibility.ts?worker&url';
import { useDispatch, useSelector } from 'react-redux';
import { StorageState } from '../../../../store';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
    AnnotationLayer,
    AnnotationType,
    TextLayer,
} from 'pdfjs-dist/legacy/build/pdf.mjs';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PdfPosition } from '../../../../../model/rpi';
import {
    setPdfClickPosition,
    setPdfNavigationTarget,
} from '../../../../store/slices/ide';

import './style.scss';
import 'pdfjs-dist/legacy/web/pdf_viewer.css';
import { useDictionary } from '../../../../store/selectors/translations';
import { Typography } from '../../../../components/typography';
import { AppDispatch } from '../../../../store';
import {
    mostVisiblePageIndex,
    namedActionPageIndex,
    nearestRectIndex,
    resolvePdfDestination,
} from '../../../../utils/pdfLinks';
import { createPdfLinkService } from './linkService';
import { PdfTextSelection } from './textSelection';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    pdfjsWorkerSrc,
    import.meta.url
).toString();

/** API/SyncTeX y is the line baseline; shift up in PDF pt, then scale to CSS px. */
const SYNCTEX_BASELINE_OFFSET_PT = 10;

/** Gap between rendered PDF pages (matches wrapper marginBottom). */
const PDF_PAGE_GAP_PX = 4;

/** Насколько палец может промахнуться мимо ссылки на сенсорном экране: половина рекомендуемой зоны нажатия в 24 px */
const TOUCH_LINK_RADIUS_PX = 12;

type PdfLinkService = Parameters<AnnotationLayer['render']>[0]['linkService'];

/** Слой ссылок страницы: из аннотаций берём только Link, поля форм и примечания просмотрщику не нужны */
async function renderLinkLayer(
    page: pdfjs.PDFPageProxy,
    wrapper: HTMLDivElement,
    viewport: pdfjs.PageViewport,
    linkService: ReturnType<typeof createPdfLinkService>
) {
    const annotations = (
        await page.getAnnotations({ intent: 'display' })
    ).filter((annotation) => annotation.annotationType === AnnotationType.LINK);
    if (annotations.length === 0) {
        return;
    }
    // слой после текстового: правило pdf.js .textLayer.selecting ~ .annotationLayer пропускает протяжку выделения сквозь ссылки
    const div = document.createElement('div');
    div.className = 'annotationLayer';
    wrapper.appendChild(div);
    const linkViewport = viewport.clone({ dontFlip: true });
    await new AnnotationLayer({
        div,
        page,
        viewport: linkViewport,
        linkService,
        accessibilityManager: null,
        annotationCanvasMap: null,
        annotationEditorUIManager: null,
        structTreeLayer: null,
        commentManager: null,
        annotationStorage: null,
    }).render({
        annotations,
        div,
        page,
        viewport: linkViewport,
        linkService: linkService as unknown as PdfLinkService,
        renderForms: false,
    });
}

/** Страницы из DOM: ссылка срабатывает и до того, как эффект перенесёт их в pageElementsRef */
const renderedPages = (container: HTMLElement) =>
    Array.from(
        container.querySelectorAll<HTMLDivElement>(':scope > [data-pdf-page]')
    );

/** Верх страницы внутри контейнера прокрутки */
const pageTopOf = (pages: HTMLDivElement[], pageIndex: number) => {
    let pageTop = 0;
    for (let i = 0; i < pageIndex; i++) {
        pageTop += pages[i].offsetHeight + PDF_PAGE_GAP_PX;
    }
    return pageTop;
};

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

    /** Колонка была скрыта в момент отрисовки, ждём, когда её покажут */
    const waitingForWidthRef = useRef(false);
    const [widthEpoch, setWidthEpoch] = useState(0);
    const [isPdfLoadingError, setIsPdfLoadingError] = useState<boolean>(false);
    const [isPdfRendering, setIsPdfRendering] = useState<boolean>(false);
    const [pageElements, setPageElements] = useState<HTMLDivElement[]>([]);
    const pageElementsRef = useRef<HTMLDivElement[]>([]);
    const textSelectionRef = useRef<PdfTextSelection | null>(null);

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

            const pageTop = pageTopOf(pages, pageIndex);

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

    /** Переход по ссылке PDF: точка назначения встаёт к верхнему краю колонки, как в pdf.js */
    const scrollToPdfPoint = useCallback(
        async (pageIndex: number, left: number | null, top: number | null) => {
            const pdf = pdfRef.current;
            const container = containerRef.current;
            if (!pdf || !container) {
                return;
            }
            const pages = renderedPages(container);
            if (!pages[pageIndex]) {
                return;
            }
            const page = await pdf.getPage(pageIndex + 1);
            if (containerRef.current !== container || pdfRef.current !== pdf) {
                return;
            }
            const viewport = page.getViewport({
                scale: pdfDisplayScaleRef.current,
            });
            const [, y] = viewport.convertToViewportPoint(
                left ?? viewport.viewBox[0],
                top ?? viewport.viewBox[3]
            );
            const scrollTop = pageTopOf(pages, pageIndex) + Math.max(0, y);
            container.scrollTo({ top: scrollTop });
            scrollTopRef.current = scrollTop;
        },
        []
    );

    /** Ссылка PDF на именованное или явное назначение */
    const goToPdfDestination = useCallback(
        async (pdf: pdfjs.PDFDocumentProxy, dest: string | unknown[]) => {
            const target = await resolvePdfDestination(dest, pdf);
            if (target && pdfRef.current === pdf) {
                await scrollToPdfPoint(
                    target.pageIndex,
                    target.left,
                    target.top
                );
            }
        },
        [scrollToPdfPoint]
    );

    /** Именованное действие PDF вроде NextPage считается от страницы, которая сейчас на экране */
    const runPdfNamedAction = useCallback(
        (action: string) => {
            const container = containerRef.current;
            if (!container) {
                return;
            }
            const pages = renderedPages(container);
            if (pages.length === 0) {
                return;
            }
            const current = mostVisiblePageIndex(
                pages.map((page, index) => ({
                    top: pageTopOf(pages, index),
                    height: page.offsetHeight,
                })),
                container.scrollTop,
                container.clientHeight
            );
            const pageIndex = namedActionPageIndex(
                action,
                current,
                pages.length
            );
            if (pageIndex !== null) {
                void scrollToPdfPoint(pageIndex, null, null);
            }
        },
        [scrollToPdfPoint]
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
            // страницы уже в DOM, даже если эффект ещё не перенёс их в pageElementsRef: ранний клик не должен теряться
            const pdf = pdfRef.current;
            if (!pdf) {
                return;
            }

            const target = event.target;
            if (!(target instanceof Element)) {
                return;
            }
            // нажатие на ссылку это переход, а не выбор места для «в редактор»
            if (target.closest('.annotationLayer .linkAnnotation')) {
                return;
            }

            const pageWrapper = target.closest('[data-pdf-page]');
            if (!(pageWrapper instanceof HTMLElement)) {
                return;
            }

            // ссылка вроде цифры \pageref на телефоне занимает несколько пикселей, поэтому нажатие рядом с ней тоже переход
            if (window.matchMedia('(pointer: coarse)').matches) {
                const links = [
                    ...pageWrapper.querySelectorAll<HTMLAnchorElement>(
                        '.annotationLayer .linkAnnotation > a'
                    ),
                ];
                const nearest = nearestRectIndex(
                    links.map((link) => link.getBoundingClientRect()),
                    event.clientX,
                    event.clientY,
                    TOUCH_LINK_RADIUS_PX
                );
                if (nearest !== null) {
                    links[nearest].click();
                    return;
                }
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
        let latestRun = 0;
        isRestoringRef.current = true;

        const loadPdf = async () => {
            // смена масштаба браузера запускает новый прогон, и прежний должен остановиться, иначе он дорисовывает страницы поверх нового
            const run = ++latestRun;
            const isStale = () => cancelled || run !== latestRun;
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
                // здесь и ниже отменённый прогон не гасит заставку: ей уже управляет новый, иначе ссылку нажмут до конца его отрисовки
                if (isStale()) {
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

                // на скрытой вкладке ширина нулевая, масштаб вышел бы отрицательным
                if (containerWidth <= 0) {
                    waitingForWidthRef.current = true;
                    setIsPdfRendering(false);
                    return;
                }
                waitingForWidthRef.current = false;

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
                const linkService = createPdfLinkService({
                    goToDestination: (dest) =>
                        void goToPdfDestination(pdf, dest),
                    executeNamedAction: runPdfNamedAction,
                });
                const textSelection = (textSelectionRef.current ??=
                    new PdfTextSelection());
                textSelection.clear();
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
                    if (isStale()) {
                        container.style.visibility = '';
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
                    // вне PDFViewer pdf_viewer.css не задаёт масштаб, без него span текста получают шрифт страницы и промахиваются мимо букв
                    wrapper.style.setProperty(
                        '--total-scale-factor',
                        String(viewport.scale * viewport.userUnit)
                    );

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
                    if (isStale()) {
                        container.style.visibility = '';
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

                    const textLayerRenderer = new TextLayer({
                        textContentSource: await page.getTextContent({
                            includeMarkedContent: true,
                            disableNormalization: true,
                        }),
                        container: textLayer,
                        viewport,
                    });
                    await textLayerRenderer.render();
                    // слой снятой страницы в выделении путает признак Firefox, а после размонтирования оставил бы обработчики на document
                    if (isStale()) {
                        container.style.visibility = '';
                        return;
                    }
                    textSelection.add(textLayer);

                    try {
                        await renderLinkLayer(
                            page,
                            wrapper,
                            viewport,
                            linkService
                        );
                    } catch (e) {
                        // без ссылок PDF всё равно читается, поэтому страницу не роняем
                        console.log(e);
                    }
                }

                if (isStale()) {
                    container.style.visibility = '';
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
                    if (isStale()) return;
                    isRestoringRef.current = false;
                    setIsPdfRendering(false);
                };

                if (hideUntilScrolled) {
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            if (isStale() || !containerRef.current) return;
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
            textSelectionRef.current?.clear();
            setIsPdfRendering(false);
        };
    }, [pdfUri, dispatch, widthEpoch, goToPdfDestination, runPdfNamedAction]);

    // колонку показали обратно: пересобираем страницы под настоящую ширину
    useEffect(() => {
        const container = containerRef.current;
        if (!container || typeof ResizeObserver === 'undefined') {
            return;
        }
        const observer = new ResizeObserver(() => {
            if (waitingForWidthRef.current && container.clientWidth > 0) {
                waitingForWidthRef.current = false;
                setWidthEpoch((epoch) => epoch + 1);
            }
        });
        observer.observe(container);
        return () => observer.disconnect();
        // контейнер существует только когда есть что показывать
    }, [pdfUri, isPdfLoadingError]);

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
