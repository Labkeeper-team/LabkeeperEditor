import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../store';
import { useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { controller } from '../../../controller.ts';

export const QrPage = () => {
    const dispatch = useDispatch<AppDispatch>();

    const { version } = useParams();

    useEffect(() => {
        if (version) {
            dispatch(controller.onQrPageEnterRequest({ version: version }));
        }
    }, [version, dispatch]);

    return <></>;
};
