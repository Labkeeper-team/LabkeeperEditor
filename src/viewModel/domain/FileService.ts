import { toast } from 'react-toastify';
import { Translations } from '../dictionaries';
import { ViewModelRepository } from '../repository';

export const checkFileErrorMessage = 'CheckFileErrorMessage';

export class FileService {
    repository: ViewModelRepository;

    constructor(repository: ViewModelRepository) {
        this.repository = repository;
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

    /*
    Если добавление происходит через Ctr+V, то segmentId is number(передается для названия),
    а в случае переименования или добавление через Add Files segmentId undefined(не передается)
     */
    calculateNumberFile = (segmentId: number | null, filename: string) => {
        let ext;
        let name = `file_seg${segmentId}`;
        const indexLastDot = filename.lastIndexOf('.');
        if (indexLastDot == -1) {
            if (segmentId == null) {
                name = filename;
            }
            ext = '';
        } else {
            ext = filename.slice(indexLastDot);
            if (segmentId == null) {
                name = filename.slice(0, indexLastDot);
            }
        }
        let resName = name + ext;
        let count = 1;
        while (
            this.repository.projectViewModelRepository
                .files()
                .find((s) => s.fileName === resName)
        ) {
            resName = name + `(${count})` + ext;
            count += 1;
        }
        return resName;
    };
}
