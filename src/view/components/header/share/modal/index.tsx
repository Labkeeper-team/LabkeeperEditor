import { useSelector, useDispatch } from 'react-redux';
import { Modal } from '../../../modal';
import { Typography } from '../../../typography';
import { Radio } from '../../../radiobutton';
import { Button } from '../../../button';
import { LinkIcon } from '../../../../icons';
import './style.scss';
import { setShowShareModal } from '../../../../../viewModel/store/slices/settings';
import { AppDispatch, StorageState } from '../../../../../viewModel/store';
import { toast } from 'react-toastify';
import { useDictionary } from '../../../../../viewModel/store/selectors/translations';
import { onProjectVisibilityChangeRequest } from '../../../../../controller';

export const ShareModal = () => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const isPublic = useSelector(
        (state: StorageState) => state.project.project?.isPublic
    );
    const showModal = useSelector(
        (state: StorageState) => state.settings.showShareModal
    );

    const handleVisibilityChange = async (option: 'private' | 'public') => {
        dispatch(
            onProjectVisibilityChangeRequest({ visible: option === 'public' })
        );
    };

    return (
        <Modal
            showModal={showModal}
            onClose={() => dispatch(setShowShareModal(false))}
        >
            <div className="share-modal">
                <Typography
                    text={dictionary.share_modal.title}
                    className="share-modal__title"
                    color="gray20"
                />
                <div className="share-modal__content">
                    <div
                        className={`radio-wrapper ${!isPublic ? 'checked' : ''}`}
                    >
                        <Radio
                            id="private-access"
                            title={dictionary.share_modal.private_access}
                            checked={!isPublic}
                            onChange={() => handleVisibilityChange('private')}
                        />
                    </div>
                    <div
                        className={`radio-wrapper ${isPublic ? 'checked' : ''}`}
                    >
                        <Radio
                            id="public-access"
                            title={dictionary.share_modal.public_access}
                            checked={!!isPublic}
                            onChange={() => handleVisibilityChange('public')}
                        />
                    </div>
                </div>
                {isPublic && (
                    <div className="share-modal__footer">
                        <Button
                            title={dictionary.share_modal.copy_link}
                            color="blue"
                            minimize={false}
                            rounded={true}
                            titleIcon={() => <LinkIcon />}
                            onPress={() => {
                                navigator.clipboard
                                    .writeText(window.location.href)
                                    .then(() => {
                                        toast(
                                            dictionary.share_modal.link_copied,
                                            {
                                                type: 'success',
                                            }
                                        );
                                    })
                                    .catch(() => {
                                        toast(
                                            dictionary.share_modal.copy_error,
                                            { type: 'error' }
                                        );
                                    });
                            }}
                        />
                    </div>
                )}
            </div>
        </Modal>
    );
};
