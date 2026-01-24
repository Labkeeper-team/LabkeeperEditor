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

    const [pageElements, setPageElements] = useState<HTMLElement[]>([]);
    useEffect(() => {
        let cancelled = false;
        const loadPdf = async () => {
            const loadingTask = pdfjs.getDocument(pdfUri);
            const pdf = await loadingTask.promise;
            pdfRef.current = pdf;
            if (cancelled) return;

            const pages: HTMLElement[] = [];
            if (containerRef.current) containerRef.current.innerHTML = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: scale });

                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                if (containerRef.current)
                    containerRef.current.appendChild(canvas);
                pages.push(canvas);

                await page.render({ canvas, viewport }).promise;
            }

            setPageElements(pages);
        };

        loadPdf();

        return () => {
            cancelled = true;
            if (containerRef.current) containerRef.current.innerHTML = '';
        };
    }, [pdfUri]);

    useEffect(() => {
        if (!activeIndex || !pdfRef.current || pageElements.length === 0)
            return;

        const scrollToSegment = async (segmentName: string) => {
            console.log('tratr');
            if (!pdfRef.current || pageElements.length === 0) return;

            const pdf = pdfRef.current;
            const dest = await pdf.getDestination(segmentName);
            if (!dest) return;
            const pageRef = dest[0];
            const pageIndex = await pdf.getPageIndex(pageRef); // 0-based
            const offsetY = typeof dest[3] === 'number' ? dest[3] : 0;

            const pageEl = pageElements[pageIndex];
            if (!pageEl || !containerRef.current) return;
            const scrollTop = pageEl.scrollHeight - offsetY * scale;
            containerRef.current.scrollTo({
                top: scrollTop,
                behavior: 'smooth',
            });
        };
        /*
    if (activeIndex === 0 || activeIndex === 1) {
        scrollToSegment(`segment1`);
        return
    }
    if (activeIndex === 2 || activeIndex === 3) {
        scrollToSegment(`segment2`);
        return
    }
    if (activeIndex === 4 || activeIndex === 5) {
        scrollToSegment(`segment3`);
        return
    }
        */
        scrollToSegment(`segment${activeIndex}`);
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
                style={{ overflow: 'auto', height: '100%',  width: 'min-content' }}
            />
        </div>
    );
};
