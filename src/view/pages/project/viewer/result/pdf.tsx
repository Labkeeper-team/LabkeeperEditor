import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { StorageState } from '../../../../store';

type Props = {
    pdfUri: string;
};

export const PdfResultViewer = ({ pdfUri }: Props) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const pdfUodated = useSelector(
        (state: StorageState) => state.ide.pdfUpdated
    );
    useEffect(() => {
        const iframe = document.createElement('iframe');
        iframe.style.border = 'none';
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        const container = containerRef.current;
        const separator = pdfUri.includes('#') ? '&' : '#';
        const cacheBust = `&ts=${pdfUodated}`;
        const withoutUi = `${pdfUri}${separator}toolbar=0&navpanes=0&scrollbar=0${cacheBust}`;
        iframe.src = withoutUi;
        if (container) {
            container.innerHTML = '';
            container.appendChild(iframe);
        }
        return () => {
            if (container) container.innerHTML = '';
        };
    }, [pdfUri, pdfUodated]);

    return (
        <div
            style={{ margin: 6, flex: 1, overflow: 'hidden', display: 'flex' }}
            ref={containerRef}
        />
    );
};
