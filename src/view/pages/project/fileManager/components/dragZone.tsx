import { useDispatch, useSelector } from 'react-redux';
import { Typography } from '../../../../components/typography';
import './drag-zone.style.scss';
import { DragEvent, useCallback } from 'react';
import { useCurrentProject } from '../../../../store/selectors/program';
import { useDictionary } from '../../../../store/selectors/translations';
import { AppDispatch } from '../../../../store';
import { controller } from '../../../../../controller.tsx';

export const FileManagerDragZone = () => {
    const dispatch = useDispatch<AppDispatch>();
    const project = useSelector(useCurrentProject);
    const dictionary = useSelector(useDictionary);

    /*
    При перетаскивании
     */
    const onDrop = useCallback(
        async (e: DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                dispatch(controller.onUploadFileRequest({ file: files[0] }));
            }
        },
        [dispatch]
    );

    if (!project) {
        return <></>;
    }

    return (
        <div onDrop={onDrop} className="manager-drag-zone-container">
            <Typography
                text={dictionary.filemanager.dropzoneTitle}
                type="body-large"
                color="black"
            />
        </div>
    );
};
