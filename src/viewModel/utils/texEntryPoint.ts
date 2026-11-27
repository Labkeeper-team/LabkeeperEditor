import type { Segment } from '../../model/domain.ts';
import { normalizeProjectFilePath } from './projectFilePath.ts';

/**
 * GH-246: откуда сервер собирает PDF. Если в корне проекта есть main.tex, то
 * из него, а сегменты не учитываются. Иначе сервер склеивает LaTeX-сегменты в
 * свой main.tex, и файл .tex проекта попадает в документ, только если сегмент
 * подключает его через \input. Новичок, открывший файл отдельно от сегментов,
 * этого не видит: правит файл и ждёт его в PDF
 *
 * - mainIgnoresSegments: открыт main.tex в корне. Пользоваться им не советуем:
 *   пока он есть, сегменты в PDF не попадают;
 * - suggestInclude: в проекте нет main.tex, а сегменты не подключают ни одного
 *   файла. Значит, открытый файл в документ точно не попадает, и подсказка
 *   предлагает подключить его;
 * - null: подсказка не нужна. Кто уже подключает файлы или собирает документ
 *   из своего main.tex, понимает, что делает, а лишняя полоса только отнимает
 *   место
 */
export type TexEntryNoteKind = 'mainIgnoresSegments' | 'suggestInclude';

/** Части документа: их подключают \input и \include. Пакеты и классы (.sty, .cls) подключаются иначе */
const DOCUMENT_PART_EXTENSIONS = ['.tex', '.ltx', '.latex', '.tikz'];

const PROJECT_MAIN_FILE = 'main.tex';

/** Любая команда, которая подключает файл. \includegraphics и \includeonly сюда не входят */
const INCLUDE_COMMAND =
    /\\(?:input|include|subfile|InputIfFileExists)(?![A-Za-z@])/;

const extensionOf = (path: string): string => {
    const name = path.slice(path.lastIndexOf('/') + 1);
    const dot = name.lastIndexOf('.');
    return dot <= 0 ? '' : name.slice(dot).toLowerCase();
};

/** Для каких файлов говорить о точке входа: только части документа */
export function isTexDocumentPart(path: string): boolean {
    return DOCUMENT_PART_EXTENSIONS.includes(extensionOf(path));
}

const isProjectMain = (path: string): boolean =>
    normalizeProjectFilePath(path) === PROJECT_MAIN_FILE;

/** Строка без комментария: всё после % без обратной косой черты перед ним */
const withoutComment = (line: string): string =>
    line.replace(/(^|[^\\])%.*$/, '$1');

/** Подключает ли хоть один LaTeX-сегмент какой-нибудь файл, не считая комментариев */
const segmentsIncludeFiles = (segments: ReadonlyArray<Segment>): boolean =>
    segments.some(
        (segment) =>
            segment.type === 'latex' &&
            segment.text
                .split('\n')
                .some((line) => INCLUDE_COMMAND.test(withoutComment(line)))
    );

export function texEntryNoteKind(
    segments: ReadonlyArray<Segment>,
    projectFiles: ReadonlyArray<string>,
    filePath: string
): TexEntryNoteKind | null {
    if (isProjectMain(filePath)) {
        return 'mainIgnoresSegments';
    }
    if (
        !isTexDocumentPart(filePath) ||
        projectFiles.some(isProjectMain) ||
        segmentsIncludeFiles(segments)
    ) {
        return null;
    }
    return 'suggestInclude';
}

/** Строка, которой подключается файл. Путь как в проекте: файлы лежат рядом с main.tex */
export const texIncludeLine = (filePath: string): string =>
    `\\input{${normalizeProjectFilePath(filePath)}}`;
