import { useNavigate } from 'react-router-dom';
import { ImageButton } from '../../imageButton';
import { Routes } from '../../../routing/routes';
import { useDispatch } from 'react-redux';
import { clearProject } from '../../../store/slices/project';

export const Back = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const onClick = () => {
    setTimeout(() => {
      dispatch(clearProject());
      navigate(Routes.Projects);
    }, 100)
  };
  return <ImageButton onClick={onClick} rotate type="outline" />;
};
