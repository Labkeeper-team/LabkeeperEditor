import { Outlet, useNavigate, useSearchParams } from 'react-router-dom';
import { Header } from '../header';
import { InterfaceTour } from '../tour';
import { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setIsFileDraggedToFileManager } from '../../../viewModel/store/slices/settings';
import { AppDispatch, StorageState } from '../../../viewModel/store';
import { setErrorMessage } from '../../../viewModel/store/slices/auth';
import {
    navigateSuccess,
    toastSuccess,
} from '../../../viewModel/store/slices/callback';
import { toast } from 'react-toastify';
import { onAppEnterRequest } from '../../../controller';

import './style.scss';
import {
    useIsDraggedToFileManager,
    useIsProjectReadonly,
} from '../../../viewModel/store/selectors/program';

let loaded = false;

export const BaseLayout = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch<AppDispatch>();

    const [searchParams] = useSearchParams();
    const dragCounter = useRef(0);

    /*
    GLOBAL STATE
     */
    const isReadonly = useSelector(useIsProjectReadonly);
    const isDragging = useSelector(useIsDraggedToFileManager);
    const navigateTo = useSelector(
        (state: StorageState) => state.callback.navigateTo
    );
    const toastMessage = useSelector(
        (state: StorageState) => state.callback.showToastMessage
    );
    const toastType = useSelector(
        (state: StorageState) => state.callback.toastType
    );

    /*
    EVENT HANDLERS
     */
    useEffect(() => {
        if (navigateTo) {
            console.debug('Navigating to', navigateTo);
            navigate(navigateTo);
            dispatch(navigateSuccess());
        }
    }, [dispatch, navigate, navigateTo]);
    useEffect(() => {
        if (toastMessage && toastType) {
            console.debug('Showing toast', toastMessage);
            toast(toastMessage, { type: toastType });
            dispatch(toastSuccess());
        }
    }, [dispatch, toastMessage, toastType]);

    /*
    Логика перетаскивания файлов
     */
    const handleDrageEnd = useCallback(() => {
        dragCounter.current = 0;
        dispatch(setIsFileDraggedToFileManager(false));
    }, [dispatch, dragCounter]);
    const handleDragOver = useCallback(
        (e) => {
            e.preventDefault();
            if (!isDragging) {
                dispatch(setIsFileDraggedToFileManager(true));
            }
        },
        [dispatch, isDragging]
    );
    const handleDragEnter = useCallback(
        (e) => {
            e.preventDefault();
            dragCounter.current += 1;
            dispatch(setIsFileDraggedToFileManager(true));
        },
        [dispatch, dragCounter]
    );
    const handleDragLeave = useCallback(
        (e) => {
            e.preventDefault();
            dragCounter.current -= 1;
            if (dragCounter.current === 0) {
                dispatch(setIsFileDraggedToFileManager(false));
            }
        },
        [dispatch, dragCounter]
    );

    /*
    Логика для отображения ошибки, которая появляется после редиректа
    через formlogin
     */
    useEffect(() => {
        const error = searchParams.get('error');
        if (error) {
            dispatch(setErrorMessage(error || ''));
        }
    }, [searchParams, dispatch]);

    useEffect(() => {
        if (!loaded) {
            dispatch(onAppEnterRequest());
            loaded = true;
        }
    }, [dispatch]);

    return (
        <div
            onDragEnter={isReadonly ? undefined : handleDragEnter}
            onDrop={isReadonly ? undefined : handleDrageEnd}
            onDragEnd={isReadonly ? undefined : handleDrageEnd}
            onDragLeave={isReadonly ? undefined : handleDragLeave}
            onDragOver={isReadonly ? undefined : handleDragOver}
        >
            <Header />
            <div className="layout-outlet-container">
                <Outlet />
            </div>
            <InterfaceTour />
        </div>
    );
};
