import { ImageButton } from '../../imageButton';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../../../viewModel/store';
import { onBackButtonClickedRequest } from '../../../../controller';

export const Back = () => {
    const dispatch = useDispatch<AppDispatch>();
    const onClick = () => {
        setTimeout(() => {
            dispatch(onBackButtonClickedRequest());
        }, 100);
    };
    return <ImageButton onClick={onClick} rotate type="outline" />;
};
