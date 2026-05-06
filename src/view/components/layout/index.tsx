/* eslint-disable react-hooks/exhaustive-deps */
import { Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { Header } from '../header';
import { InterfaceTour } from '../tour';
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setIsFileDraggedToFileManager } from '../../store/slices/settings';
import { AppDispatch } from '../../store';
import { Routes } from '../../../viewModel/routes.ts';

import './style.scss';
import {
    useIsDraggedToFileManager,
    useIsProjectReadonly,
} from '../../store/selectors/program';
import { controller } from '../../../main.tsx';
import classNames from 'classnames';
import { VIEWPORT_RESCALE_EVENT } from '../../hooks/useScaleToMinWidth';

let loaded = false;

export const BaseLayout = () => {
    const dispatch = useDispatch<AppDispatch>();
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const state = searchParams.get('state') || '';
    const code = searchParams.get('code') || '';
    const from = searchParams.get('from') || undefined;
    const dragCounter = useRef(0);
    const captcha = searchParams.get('captcha') || undefined;
    const isTokensPage = location.pathname === Routes.Tokens;

    /*
    GLOBAL STATE
     */
    const isReadonly = useSelector(useIsProjectReadonly);
    const isDragging = useSelector(useIsDraggedToFileManager);

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
                    controller.onAppEnterWithOauthCodeRequest({
                        code: code,
                        state: state,
                    })
                );
            } else {
                dispatch(controller.onAppEnterRequest({ from, captcha }));
            }
            loaded = true;
        }
    }, [dispatch]);

    useEffect(() => {
        const cls = 'tokens-route';
        if (isTokensPage) {
            document.documentElement.classList.add(cls);
            document.body.classList.add(cls);
        } else {
            document.documentElement.classList.remove(cls);
            document.body.classList.remove(cls);
        }
        return () => {
            document.documentElement.classList.remove(cls);
            document.body.classList.remove(cls);
        };
    }, [isTokensPage]);

    useLayoutEffect(() => {
        window.dispatchEvent(new Event(VIEWPORT_RESCALE_EVENT));
    }, [location.pathname]);

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
                className={classNames('layout-outlet-container', {
                    'layout-outlet-container--landing': isTokensPage,
                })}
            >
                <Outlet />
            </div>
            <InterfaceTour />
        </div>
    );
};
