import { toast } from 'react-toastify';
import { Translations } from './dictionaries';
import { ViewModelState } from './viewModelState';

export const checkFileErrorMessage = 'CheckFileErrorMessage';

export class FileService {
    vms: ViewModelState;

    constructor(vms: ViewModelState) {
        this.vms = vms;
    }
    checkFile = (file: File, dictionary: Translations) => {
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
        if (
            !file.type.startsWith('image/') &&
            !file.type.startsWith('text/csv')
        ) {
            toast(dictionary.filemanager.errors.notSupported, {
                type: 'error',
            });
            throw new Error(checkFileErrorMessage);
        }
    };

    calculateNumberFile = (segmentId: number, filename: string) => {
        const [, ext] = filename.split('.');
        let name = `file_seg${segmentId}`;
        let count = 0;
        while (
            this.vms.projectViewModelState
                .files()
                .find((s) => s.fileName === name + `.${ext}`)
        ) {
            count += 1;
            name = name.split('(')[0] + `(${count})`;
        }
        name += `.${ext}`;
        return name;
    };
}
