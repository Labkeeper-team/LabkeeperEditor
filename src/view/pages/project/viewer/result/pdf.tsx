import { useSelector } from 'react-redux';
import { StorageState } from '../../../../store';

type Props = {
    pdfUri: string;
};

export const PdfResultViewer = ({ pdfUri }: Props) => {
    const pdfUodated = useSelector(
        (state: StorageState) => state.ide.pdfUpdated
    );

    return (
        <div
            style={{ margin: 6, flex: 1, overflow: 'hidden', display: 'flex' }}
        >
            <iframe
                src={`${pdfUri}#toolbar=0`}
                key={pdfUodated}
                style={{ border: 'none', width: '100%', height: '100%' }}
            ></iframe>
        </div>
    );
};
