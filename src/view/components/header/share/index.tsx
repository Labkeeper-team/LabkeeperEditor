import { useSelector, useDispatch } from 'react-redux';
import { ShareIcon } from '../../../icons';
import { useCurrentProject } from '../../../store/selectors/program';
import { setShowShareModal } from '../../../store/slices/settings';
import { controller } from '../../../../main.tsx';
import { Events } from '../../../../model/service/ObserverService.ts';
import './style.scss';

export const ShareButton = () => {
    const dispatch = useDispatch();
    const project = useSelector(useCurrentProject);

    if (!project || !project.title) {
        return null;
    }

    return (
        <button
            className="share-button"
            onClick={() => {
                controller.trackUiEvent(Events.EVENT_SHARE_MODAL_OPENED);
                dispatch(setShowShareModal(true));
            }}
        >
            <ShareIcon />
        </button>
    );
};
