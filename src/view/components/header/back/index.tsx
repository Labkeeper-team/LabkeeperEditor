import { ImageButton } from '../../imageButton';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../../store';
import { controller } from '../../../../controller.ts';

export const Back = () => {
    const dispatch = useDispatch<AppDispatch>();
    const onClick = () => {
        setTimeout(() => {
            dispatch(controller.onBackButtonClickedRequest());
        }, 100);
    };
    return <ImageButton onClick={onClick} rotate type="outline" />;
};
