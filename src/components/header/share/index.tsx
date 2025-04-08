import { useSelector, useDispatch } from 'react-redux';
import { ShareIcon } from '../../../shared/icons';
import { useCurrentProject } from '../../../store/selectors/program';
import { setShowShareModal } from '../../../store/slices/settings';
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
            onClick={() => dispatch(setShowShareModal(true))}
        >
            <ShareIcon />
        </button>
    );
};
