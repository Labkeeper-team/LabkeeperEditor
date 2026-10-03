import { toast } from 'react-toastify';
import { Translations } from '../dictionaries';
import { ViewModelRepository } from '../repository';
import {
    Events,
    ObserverService,
} from '../../model/service/ObserverService.ts';
import { fileExtension, trackEvent } from '../utils/observerContext.ts';
import { SUPPORTED_EXTENSIONS } from './supportedFileExtensions.ts';

export class FileService {
    repository: ViewModelRepository;
    observerService: ObserverService;

    constructor(
        repository: ViewModelRepository,
        observerService: ObserverService
    ) {
        this.repository = repository;
        this.observerService = observerService;
    }

    private trackRejected = (file: File, reason: 'too_big' | 'format') => {
        trackEvent(
            this.observerService,
            this.repository,
            Events.EVENT_FILE_UPLOAD_REJECTED,
            {
                reason,
                // расширение файла, а не имя: имя пользователя в аналитику не уходит
                extension: fileExtension(file.name) ?? '',
                mime_type: file.type,
                size: file.size,
            }
        );
    };

    checkFile = (file: File, dictionary: Translations): boolean => {
        const mbInBytes = 1048576;
        const maxSizeInMb = 5;
        if (file.size > mbInBytes * maxSizeInMb) {
            this.trackRejected(file, 'too_big');
            toast(
                dictionary.filemanager.errors.tooBigFile.replace(
                    '${replace1}',
                    maxSizeInMb.toString()
                ),
                { type: 'error' }
            );
            return false;
        }
        const fileName = file.name.toLowerCase();
        const hasSupportedExtension = SUPPORTED_EXTENSIONS.some((ext) =>
            fileName.endsWith(ext)
        );
        if (
            !file.type.startsWith('image/') &&
            !file.type.startsWith('text/csv') &&
            !file.type.startsWith('text/plain') &&
            !file.type.startsWith('application/x-tex') &&
            !file.type.startsWith('application/x-bibtex') &&
            !file.type.startsWith('application/bibtex') &&
            !hasSupportedExtension
        ) {
            this.trackRejected(file, 'format');
            toast(dictionary.filemanager.errors.notSupported, {
                type: 'error',
            });
            return false;
        }
        return true;
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
