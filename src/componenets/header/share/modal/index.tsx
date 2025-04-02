import { useSelector, useDispatch } from 'react-redux';
import { Modal } from '../../../../shared/components/modal';
import { Typography } from '../../../typography';
import { Radio } from '../../../radiobutton';
import './style.scss';
import { useState } from 'react';
import { setShowShareModal } from "../../../../store/slices/settings";
import { StorageState } from "../../../../store";

export const ShareModal = () => {
  const dispatch = useDispatch();
  const [selectedOption, setSelectedOption] = useState('private');
  const showModal = useSelector((state: StorageState) => state.settings.showShareModal);

  return (
    <Modal showModal={showModal} onClose={() => dispatch(setShowShareModal(false))}>
      <div className="share-modal">
        <Typography 
          text="Share to 'The earliest fish appeared during the Cambria...'" 
          className="share-modal__title"
        />
        <div className="share-modal__content">
          <Radio
            id="private-access"
            title="Access is only for me"
            checked={selectedOption === 'private'}
            onChange={() => setSelectedOption('private')}
          />
          <Radio
            id="public-access"
            title="Access for everyone"
            checked={selectedOption === 'public'}
            onChange={() => setSelectedOption('public')}
          />
        </div>
      </div>
    </Modal>
  );
}; 