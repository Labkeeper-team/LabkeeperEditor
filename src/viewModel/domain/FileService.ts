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
        const supportedExtensions = [
            '.png',
            '.jpg',
            '.jpeg',
            '.svg',
            '.txt',
            '.csv',
            '.tex',
        ];
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
        const fileName = file.name.toLowerCase();
        const hasSupportedExtension = supportedExtensions.some((ext) =>
            fileName.endsWith(ext)
        );
        if (
            !file.type.startsWith('image/') &&
            !file.type.startsWith('text/csv') &&
            !file.type.startsWith('text/plain') &&
            !file.type.startsWith('application/x-tex') &&
            !hasSupportedExtension
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
    calculateNumberFile = (
        segmentId: number | null,
        filename: string,
        folderPrefix?: string | null
    ) => {
        const pathPrefix =
            folderPrefix ??
            (filename.includes('/')
                ? filename.slice(0, filename.lastIndexOf('/'))
                : '');
        const basename = filename.includes('/')
            ? filename.slice(filename.lastIndexOf('/') + 1)
            : filename;

        let ext = '';
        let name: string;
        const indexLastDot = basename.lastIndexOf('.');
        if (indexLastDot === -1) {
            name = segmentId == null ? basename : `file_seg${segmentId}`;
        } else {
            ext = basename.slice(indexLastDot);
            name =
                segmentId == null
                    ? basename.slice(0, indexLastDot)
                    : `file_seg${segmentId}`;
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
        if (folderPrefix) {
            return `${folderPrefix}/${resName}`;
        }
        if (pathPrefix) {
            return `${pathPrefix}/${resName}`;
        }
        return resName;
    };

    joinWithFolderPrefix = (
        folderPrefix: string | null | undefined,
        name: string
    ) => {
        if (!folderPrefix) {
            return name;
        }
        return `${folderPrefix}/${name}`;
    };
}
