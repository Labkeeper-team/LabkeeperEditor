import { useSelector } from 'react-redux';
import { StorageState } from '../../../../store';
import { useEffect } from 'react';

type Props = {
    pdfUri: string;
};

export const PdfResultViewer = ({ pdfUri }: Props) => {
    const pdfUpdated = useSelector(
        (state: StorageState) => state.ide.pdfUpdated
    );
    const activeIndex = useSelector(
        (state: StorageState) => state.ide.activeSegmentIndex
    );

    useEffect(() => {
        // TODO scroll the pdf
    }, [activeIndex]);

    return (
        <div
            style={{ margin: 6, flex: 1, overflow: 'hidden', display: 'flex' }}
        >
            <iframe
                src={`${pdfUri}#toolbar=0`}
                key={pdfUpdated}
                style={{ border: 'none', width: '100%', height: '100%' }}
            ></iframe>
        </div>
    );
};
