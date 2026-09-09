import classNames from 'classnames';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, StorageState } from '../../../../store';
import { useDictionary } from '../../../../store/selectors/translations';
import { controller } from '../../../../../main.tsx';
import { Transcript } from './Transcript';
import { PromptField } from './PromptField';
import './style.scss';

export const AgentChat = () => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const messages = useSelector((state: StorageState) => state.chat.messages);
    const history = useSelector((state: StorageState) => state.chat.history);
    const projectId = useSelector(
        (state: StorageState) => state.project.project?.projectId
    );
    const isAuthenticated = useSelector(
        (state: StorageState) => state.user.isAuthenticated
    );

    // история привязана к проекту и к пользователю, поэтому тянем её и после
    // смены проекта, и после входа в аккаунт, а не только при первом показе
    useEffect(() => {
        dispatch(controller.onChatOpenedRequest());
    }, [dispatch, projectId, isAuthenticated]);

    const isEmpty = messages.length === 0 && history.length === 0;

    return (
        <div
            className={classNames('agent-chat', {
                'agent-chat--empty': isEmpty,
            })}
        >
            <Transcript />
            <PromptField />
            {isEmpty && (
                <div className="agent-chat__disclaimer">
                    {dictionary.agent_chat.disclaimer}
                </div>
            )}
        </div>
    );
};
