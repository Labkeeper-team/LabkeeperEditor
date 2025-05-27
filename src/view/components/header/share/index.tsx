import { useSelector, useDispatch } from 'react-redux';
import { ShareIcon } from '../../../icons';
import { useCurrentProject } from '../../../../viewModel/store/selectors/program';
import { setShowShareModal } from '../../../../viewModel/store/slices/settings';
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
