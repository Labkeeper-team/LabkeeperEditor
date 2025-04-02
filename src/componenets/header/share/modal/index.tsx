import { useSelector, useDispatch } from 'react-redux';
import { Modal } from '../../../../shared/components/modal';
import { Typography } from '../../../typography';
import { Radio } from '../../../radiobutton';
import { Button } from '../../../button';
import { LinkIcon } from '../../../../shared/icons';
import './style.scss';
import { useState, useEffect } from 'react';
import { setShowShareModal } from "../../../../store/slices/settings";
import { StorageState } from "../../../../store";
import { useCurrentProject, useCurrentProjectId } from '../../../../store/selectors/program';
import { setProjectVisibilityRequest } from '../../../../rpi/project';
import { toast } from 'react-toastify';
import { useDictionary } from '../../../../store/selectors/translations';
import { logoutAction } from '../../../../store/actions';

export const ShareModal = () => {
  const dispatch = useDispatch();
  const project = useSelector(useCurrentProject);
  const projectId = useSelector(useCurrentProjectId);
  const dictionary = useSelector(useDictionary);
  const [selectedOption, setSelectedOption] = useState('private');
  const showModal = useSelector((state: StorageState) => state.settings.showShareModal);

  useEffect(() => {
    if (project?.isPublic !== undefined) {
      setSelectedOption(project.isPublic ? 'public' : 'private');
    }
  }, [project?.isPublic]);

  const handleVisibilityChange = async (option: string) => {
    if (!projectId) return;
    
    const result = await setProjectVisibilityRequest(projectId.toString(), option === 'public');
    
    if (result.isUnauth) {
      toast(dictionary.filemanager.errors.sessionExpired, {type: 'error'});
      dispatch(logoutAction);
      return;
    }
    
    if (result.isOk) {
      setSelectedOption(option);
    }
  };

  return (
    <Modal showModal={showModal} onClose={() => dispatch(setShowShareModal(false))}>
      <div className="share-modal">
        <Typography 
          text="Share to 'The earliest fish appeared during the Cambria...'" 
          className="share-modal__title"
          color="gray20"
        />
        <div className="share-modal__content">
          <div className={`radio-wrapper ${selectedOption === 'private' ? 'checked' : ''}`}>
            <Radio
              id="private-access"
              title="Access is only for me"
              checked={selectedOption === 'private'}
              onChange={() => handleVisibilityChange('private')}
            />
          </div>
          <div className={`radio-wrapper ${selectedOption === 'public' ? 'checked' : ''}`}>
            <Radio
              id="public-access"
              title="Access for everyone"
              checked={selectedOption === 'public'}
              onChange={() => handleVisibilityChange('public')}
            />
          </div>
        </div>
        <div className="share-modal__footer">
          <Button
            title="Copy the link for sharing"
            color="blue"
            minimize={false}
            rounded={true}
            titleIcon={() => <LinkIcon />}
            onPress={() => {
              // TODO: Add copy link logic
              console.log('Copy link clicked');
            }}
          />
        </div>
      </div>
    </Modal>
  );
}; 