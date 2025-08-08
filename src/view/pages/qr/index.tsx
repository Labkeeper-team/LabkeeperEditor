import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../../viewModel/store';
import { useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { onQrPageEnterRequest } from '../../../controller';

export const QrPage = () => {
    const dispatch = useDispatch<AppDispatch>();

    const { version } = useParams();

    useEffect(() => {
        if (version) {
            dispatch(onQrPageEnterRequest({ version: version }));
        }
    }, [version]);

    return <></>;
};
