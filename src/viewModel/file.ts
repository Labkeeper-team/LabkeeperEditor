import { toast } from 'react-toastify';
import { Translations } from './store/shared/dictionaries';

export const fileUploadHeader = {
    'Content-Type': 'multipart/form-data',
    Accept: '*/*',
};

export const checkFileErrorMessage = 'CheckFileErrorMessage';

export const checkFile = (file: File, dictionary: Translations) => {
    const mbInBytes = 1048576;
    const maxSizeInMb = 5;
    if (file.size > mbInBytes * maxSizeInMb) {
        toast(
            dictionary.filemanager.errors.tooBigFile.replace(
                '${replace1}',
                maxSizeInMb.toString()
            ),
            { type: 'error' }
        );
        throw new Error(checkFileErrorMessage);
    }

    if (!file.type.startsWith('image/') && !file.type.startsWith('text/csv')) {
        toast(dictionary.filemanager.errors.notSupported, { type: 'error' });
        throw new Error(checkFileErrorMessage);
    }
};
