import { useSelector } from 'react-redux';
import { StorageState } from '../../../../store';
import * as pdfjs from 'pdfjs-dist';
import { useEffect, useRef, useState } from 'react';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
).toString();

const scale = 1.3;

export const PdfResultViewer = () => {
    const pdfUri = useSelector((state: StorageState) => state.project.pdfUri);

    const containerRef = useRef<HTMLDivElement>(null);
    const pdfRef = useRef<pdfjs.PDFDocumentProxy | null>(null);

    const activeIndex = useSelector(
        (state: StorageState) => state.ide.activeSegmentIndex
    );

    const scrollTopRef = useRef<number>(0);
    const isRestoringRef = useRef<boolean>(true);

    const [pageElements, setPageElements] = useState<HTMLElement[]>([]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const onScroll = () => {
            if (isRestoringRef.current) return;
            scrollTopRef.current = container.scrollTop;
        };

        container.addEventListener('scroll', onScroll);

        return () => {
            container.removeEventListener('scroll', onScroll);
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        isRestoringRef.current = true;

        const loadPdf = async () => {
            const pdf = await pdfjs.getDocument(pdfUri).promise;
            if (cancelled) return;

            pdfRef.current = pdf;

            if (containerRef.current) {
                containerRef.current.innerHTML = '';
            }

            const pages: HTMLElement[] = [];

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale });

                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                containerRef.current?.appendChild(canvas);
                pages.push(canvas);

                await page.render({ canvas, viewport }).promise;
            }

            setPageElements(pages);
        };

        loadPdf();

        return () => {
            cancelled = true;
        };
    }, [pdfUri]);

    useEffect(() => {
        if (!containerRef.current || pageElements.length === 0) return;

        containerRef.current.scrollTo({
            top: scrollTopRef.current,
            behavior: 'auto',
        });

        requestAnimationFrame(() => {
            isRestoringRef.current = false;
        });
    }, [pageElements]);

    useEffect(() => {
        if (activeIndex == null || !pdfRef.current || pageElements.length === 0)
            return;

        const scrollToSegment = async (activeIndex_: number) => {
            const pdf = pdfRef.current!;
            const dest = await pdf.getDestination(`segment${activeIndex_}`);
            if (!dest || !containerRef.current) return;

            const pageIndex = await pdf.getPageIndex(dest[0]);
            const offsetY = typeof dest[3] === 'number' ? dest[3] : 0;

            const pageEl = pageElements[pageIndex];
            if (!pageEl) return;

            isRestoringRef.current = true;
            const scrollTop = pageEl.scrollHeight - offsetY * scale;

            containerRef.current.scrollTo({
                top: scrollTop,
                behavior: 'smooth',
            });

            requestAnimationFrame(() => {
                isRestoringRef.current = false;
            });
        };
        scrollToSegment(activeIndex);
    }, [activeIndex, pageElements]);

    return (
        <div
            style={{
                margin: 6,
                flex: 1,
                overflow: 'hidden',
                display: 'flex',
                justifyContent: 'center',
                background: 'gray',
            }}
        >
            <div
                ref={containerRef}
                style={{
                    overflow: 'auto',
                    height: '100%',
                    width: 'min-content',
                }}
            />
        </div>
    );
};
