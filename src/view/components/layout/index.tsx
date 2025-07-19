import {
    Outlet,
    useLocation,
    useNavigate,
    useSearchParams,
} from 'react-router-dom';
import { Header } from '../header';
import { InterfaceTour } from '../tour';
import { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setIsFileDraggedToFileManager } from '../../../viewModel/store/slices/settings';
import { AppDispatch, StorageState } from '../../../viewModel/store';
import {
    navigateSuccess,
    toastSuccess,
} from '../../../viewModel/store/slices/callback';
import { toast } from 'react-toastify';
import {
    onAppEnterRequest,
    onAppEnterWithOauthCodeRequest,
} from '../../../controller';
import { Routes } from '../../routing/routes.ts';

let loaded = false;

export const BaseLayout = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch<AppDispatch>();
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const state = searchParams.get('state') || '';
    const code = searchParams.get('code') || '';
    const dragCounter = useRef(0);

    /*
    GLOBAL STATE
     */
    const isReadonly = useSelector(
        (state: StorageState) => state.project.projectIsReadonly
    );
    const isDragging = useSelector(
        (state: StorageState) => state.settings.isFileDraggedToManager
    );
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
            console.log('Navigating to', navigateTo);
            navigate(navigateTo);
            dispatch(navigateSuccess());
        }
    }, [dispatch, navigate, navigateTo]);
    useEffect(() => {
        if (toastMessage && toastType) {
            console.log('Showing toast', toastMessage);
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

    useEffect(() => {
        if (!loaded) {
            if (location.pathname.includes(Routes.CodePage)) {
                dispatch(
                    onAppEnterWithOauthCodeRequest({ code: code, state: state })
                );
            } else {
                dispatch(onAppEnterRequest());
            }
            loaded = true;
        }
    }, []);

    return (
        <div
            onDragEnter={isReadonly ? undefined : handleDragEnter}
            onDrop={isReadonly ? undefined : handleDrageEnd}
            onDragEnd={isReadonly ? undefined : handleDrageEnd}
            onDragLeave={isReadonly ? undefined : handleDragLeave}
            onDragOver={isReadonly ? undefined : handleDragOver}
        >
            <Header />
            <div
                style={{
                    marginLeft: '20px',
                    marginRight: '20px',
                    marginBottom: '20px',
                }}
            >
                <Outlet />
            </div>
            <InterfaceTour />
        </div>
    );
};
