import { toast } from 'react-toastify';
import { Translations } from '../dictionaries';
import { ViewModelRepository } from '../repository';
import {
    Events,
    ObserverService,
} from '../../model/service/ObserverService.ts';
import { fileExtension, trackEvent } from '../utils/observerContext.ts';
import {
    hasBinaryExtension,
    looksLikeTextFile,
} from './supportedFileExtensions.ts';
import { getPhantomFileNamesFromHunks } from '../utils/hunkGrouping.ts';
import { projectFilePathsMatch } from '../utils/projectFilePath.ts';

const TOKEN_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const TOKEN_LENGTH = 6;

/** Шесть случайных символов: имя вставленного файла с ними не повторяется */
const randomFileToken = (): string =>
    Array.from(
        crypto.getRandomValues(new Uint8Array(TOKEN_LENGTH)),
        (byte) => TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length]
    ).join('');

export class FileService {
    repository: ViewModelRepository;
    observerService: ObserverService;
    /** Хвост имени вставленного файла, в опытах подменяется */
    createFileToken: () => string = randomFileToken;

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

    checkFile = async (
        file: File,
        dictionary: Translations
    ): Promise<boolean> => {
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
        // GH-209: текст принимаем с любым расширением, двоичное только из списка
        const isSupported =
            file.type.startsWith('image/') ||
            hasBinaryExtension(file.name) ||
            (await looksLikeTextFile(file).catch(() => false));
        if (!isSupported) {
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
    GH-173: у вставленного файла в имени случайный хвост. Иначе новая картинка получала
    имя удалённой, ссылка в тексте не менялась, и на странице оставалась старая картинка
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

        const pastedName = () =>
            `file_seg${segmentId}_${this.createFileToken()}`;
        let ext = '';
        let name: string;
        const indexLastDot = basename.lastIndexOf('.');
        if (indexLastDot === -1) {
            name = segmentId == null ? basename : pastedName();
        } else {
            ext = basename.slice(indexLastDot);
            name =
                segmentId == null
                    ? basename.slice(0, indexLastDot)
                    : pastedName();
        }

        // GH-188: файл, удалённый или созданный агентом, держит имя, пока по правке не решили.
        // Иначе новый файл занял бы его, и правка агента повисла бы на чужом файле
        const heldByAgent = getPhantomFileNamesFromHunks(
            this.repository.ideViewModelRepository.hunks(),
            this.repository.projectViewModelRepository
                .files()
                .map((file) => file.fileName)
        );
        const prefix = folderPrefix || pathPrefix;
        const isHeld = (candidate: string) =>
            heldByAgent.some((held) =>
                projectFilePathsMatch(
                    held,
                    prefix ? `${prefix}/${candidate}` : candidate
                )
            );
        let resName = name + ext;
        let count = 1;
        while (
            this.repository.projectViewModelRepository
                .files()
                .find((s) => s.fileName === resName) ||
            isHeld(resName)
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
