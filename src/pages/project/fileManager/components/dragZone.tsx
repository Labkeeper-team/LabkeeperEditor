import { useDispatch, useSelector } from 'react-redux';
import { Typography } from '../../../../componenets/typography';
import './drag-zone.style.scss';
import { setisFileDraggedToFileManager } from '../../../../store/slices/settings';
import { DragEvent } from 'react';
import { useCurrentProject } from '../../../../store/selectors/program';
import { useDictionary } from '../../../../store/selectors/translations';
import { uploadFileRequest } from '../../../../rpi/files.tsx';
import { logoutAction } from '../../../../store/actions';
import { toast } from 'react-toastify';
import { checkFile } from '../../../../utils/file';
import { StorageState } from '../../../../store';

export const FileManagerDragZone = (props: {
    onSuccess?: () => unknown;
    onError?: (e: unknown) => unknown;
}) => {
    const dispatch = useDispatch();
    const project = useSelector(useCurrentProject);
    const dictionary = useSelector(useDictionary);
    const isReadonly = useSelector(
        (state: StorageState) => state.project.projectIsReadonly
    );

    const onDrop = async (e: DragEvent<HTMLDivElement>) => {
        if (!project || !project?.projectId || isReadonly) {
            return;
        }
        dispatch(setisFileDraggedToFileManager(false));
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const [fileToUpload] = files;
            checkFile(fileToUpload, dictionary);
            const formData = new FormData();
            formData.append('file', fileToUpload);
            const result = await uploadFileRequest(
                formData,
                project?.projectId?.toString(),
                fileToUpload.name
            );
            if (result.isUnauth) {
                toast(dictionary.filemanager.errors.sessionExpired, {
                    type: 'error',
                });
                dispatch(logoutAction);
            }
            if (!result.isOk) {
                await props.onError?.(e);
            } else {
                await props.onSuccess?.();
            }

            // Обработка файла
        }
    };
    if (!project?.projectId) {
        return;
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
