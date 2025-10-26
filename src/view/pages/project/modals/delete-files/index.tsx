import { useDispatch, useSelector } from 'react-redux';
import './style.scss';
import { Button } from '../../../../components/button';
import { Typography } from '../../../../components/typography';
import { Modal } from '../../../../components/modal';
import { AppDispatch, StorageState } from '../../../../store';
import { useDictionary } from '../../../../store/selectors/translations.ts';
import { controller } from '../../../../../controller.ts';
import { FileIcon } from '../../../../icons';

export const DeleteFilesModal = () => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const filesToDelete = useSelector(
        (state: StorageState) => state.settings.filesToDelete
    );

    const onClose = () => {
        dispatch(controller.onDeleteFilesCancelRequest());
    };

    const onConfirm = () => {
        dispatch(controller.onDeleteFilesConfirmRequest());
    };

    const show = (filesToDelete?.length ?? 0) > 0;

    return (
        <Modal showModal={show} onClose={onClose}>
            <div className="delete-files-modal">
                <Typography
                    type="h2"
                    text={dictionary.delete_files_modal.title}
                    color="#0d0d0d"
                />
                <div className="delete-files-list">
                    {filesToDelete?.map((f, index) => (
                        <div className="delete-files-item" key={index}>
                            <span className="delete-files-item__icon">
                                <FileIcon />
                            </span>
                            <span className="delete-files-item__name">
                                {f.fileName}
                            </span>
                        </div>
                    ))}
                </div>
                <div className="delete-files-actions">
                    <Button
                        rounded
                        color="blue"
                        minimize={false}
                        title={dictionary.yes}
                        onPress={onConfirm}
                    />
                    <Button
                        rounded
                        color="gray"
                        minimize={false}
                        title={dictionary.no}
                        onPress={onClose}
                    />
                </div>
            </div>
        </Modal>
    );
};
