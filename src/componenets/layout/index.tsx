import {Outlet, useLocation, useSearchParams} from 'react-router-dom';
import { Header } from '../header';
import { InterfaceTour } from '../../shared/components/tour';
import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNeedLogin } from '../../store/selectors/program';
import { Routes } from '../../routing/routes';
import { LoginModal } from '../loginModal';
import { Modal } from '../../shared/components/modal';
import { setNeedLogin } from '../../store/slices/ide';
import {setUser} from "../../store/slices/user";
import { setisFileDraggedToFileManager } from '../../store/slices/settings';
import { StorageState } from '../../store';
import {setErrorMessage} from "../../store/slices/auth";

export const BaseLayout = () => {
  const [searchParams] = useSearchParams();
  const dispatch = useDispatch();
  const needLogin = useSelector(useNeedLogin);

  const location = useLocation()

  const dragCounter = useRef(0);
  const isDragging = useSelector((state: StorageState) => state.settings.isFileDraggedToManager);
  
  const handleDrageEnd = () => {
    dragCounter.current = 0;
    dispatch(setisFileDraggedToFileManager(false));
  }
  
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
        const error = searchParams.get('error')
        if (error) {
            dispatch(setErrorMessage(error || ''))
        }
    }, [searchParams]);
    useEffect(() => {
        fetch(Routes.UserInfo)
            .then(re => re.json())
            .then(user => dispatch(setUser(user)))
    }, [location]);

  return (
    <div  onDragEnter={handleDragEnter} onDrop={handleDrageEnd} onDragEnd={handleDrageEnd} onDragLeave={handleDragLeave} onDragOver={handleDragOver}>
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
      <Modal
        onClose={() => dispatch(setNeedLogin(false))}
        showModal={!!needLogin}
      >
        <LoginModal />
      </Modal>
    </div>
  );
};
