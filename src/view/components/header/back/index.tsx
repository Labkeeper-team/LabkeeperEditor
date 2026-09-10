import { ImageButton } from '../../imageButton';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '../../../store';
import { controller } from '../../../../main.tsx';
import { useIsAgentRunning } from '../../../store/selectors/program';
import { useDictionary } from '../../../store/selectors/translations';

export const Back = () => {
    const dispatch = useDispatch<AppDispatch>();
    const isAgentRunning = useSelector(useIsAgentRunning);
    const dictionary = useSelector(useDictionary);
    const onClick = () => {
        // спрашиваем до сброса, а не после: уход отсюда сначала чистит проект
        // и гасит агента, и на отказ пользователю нечего было бы показать
        if (
            isAgentRunning &&
            !window.confirm(dictionary.agent_chat.leave_confirm)
        ) {
            return;
        }
        setTimeout(() => {
            dispatch(controller.onBackButtonClickedRequest());
        }, 100);
    };
    return <ImageButton onClick={onClick} rotate type="outline" />;
};
