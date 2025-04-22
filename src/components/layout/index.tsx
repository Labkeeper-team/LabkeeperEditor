import { Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { Header } from '../header';
import { InterfaceTour } from '../../shared/components/tour';
import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Routes } from '../../routing/routes';
import { setUser } from '../../store/slices/user';
import { setisFileDraggedToFileManager } from '../../store/slices/settings';
import { StorageState } from '../../store';
import { setErrorMessage } from '../../store/slices/auth';

export const BaseLayout = () => {
    const [searchParams] = useSearchParams();
    const dispatch = useDispatch();
    const isReadonly = useSelector(
        (state: StorageState) => state.project.projectIsReadonly
    );

    const location = useLocation();

    const dragCounter = useRef(0);
    const isDragging = useSelector(
        (state: StorageState) => state.settings.isFileDraggedToManager
    );

    const handleDrageEnd = () => {
        dragCounter.current = 0;
        dispatch(setisFileDraggedToFileManager(false));
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        if (!isDragging) {
            dispatch(setisFileDraggedToFileManager(true));
        }
    };

    const handleDragEnter = (e) => {
        e.preventDefault();
        dragCounter.current += 1;
        dispatch(setisFileDraggedToFileManager(true));
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        dragCounter.current -= 1;
        if (dragCounter.current === 0) {
            dispatch(setisFileDraggedToFileManager(false));
        }
    };

    useEffect(() => {
        const error = searchParams.get('error');
        if (error) {
            dispatch(setErrorMessage(error || ''));
        }
    }, [searchParams]);
    useEffect(() => {
        fetch(Routes.UserInfo)
            .then((re) => re.json())
            .then((user) => dispatch(setUser(user)));
    }, [location]);

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
