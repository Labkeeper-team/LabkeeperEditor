import type { Segment } from '../../model/domain.ts';
import { normalizeProjectFilePath } from './projectFilePath.ts';

/**
 * GH-246: PDF собирается из сегментов. Сервер склеивает LaTeX-сегменты в свой
 * main.tex и компилирует его, а файл .tex проекта попадает в документ, только
 * если сегмент подключает его через \input или \include. Человек, открывший
 * файл отдельно от сегментов, этого не видит: правит файл и ждёт его в PDF
 *
 * - replacedByMain: файл main.tex в корне. Сервер положит на его место
 *   собранный из сегментов, и сам файл не соберётся никогда;
 * - included: сегмент подключает файл, segmentIndex и line (1-based) указывают
 *   на первую такую строку;
 * - notIncluded: ни один сегмент файл не подключает. Он может попасть в
 *   документ только из другого подключённого файла
 */
export type TexEntryPointStatus =
    | { kind: 'replacedByMain' }
    | { kind: 'included'; segmentIndex: number; line: number }
    | { kind: 'notIncluded' };

/** Части документа: их подключают \input и \include. Пакеты и классы (.sty, .cls) подключаются иначе */
const DOCUMENT_PART_EXTENSIONS = ['.tex', '.ltx', '.latex', '.tikz'];

const SERVER_MAIN_FILE = 'main.tex';

const INCLUDE_COMMAND =
    /\\(?:input|include|subfile|InputIfFileExists)\s*\{([^{}]+)\}/g;

const extensionOf = (path: string): string => {
    const name = path.slice(path.lastIndexOf('/') + 1);
    const dot = name.lastIndexOf('.');
    return dot <= 0 ? '' : name.slice(dot).toLowerCase();
};

/** Для каких файлов говорить о точке входа: только части документа */
export function isTexDocumentPart(path: string): boolean {
    return DOCUMENT_PART_EXTENSIONS.includes(extensionOf(path));
}

/** Строка без комментария: всё после % без обратной косой черты перед ним */
const withoutComment = (line: string): string =>
    line.replace(/(^|[^\\])%.*$/, '$1');

/** Аргумент \input так, как его ищет TeX: без ./ в начале и с .tex, если расширения нет */
const includedPath = (argument: string): string => {
    const path = normalizeProjectFilePath(
        argument.trim().replace(/^(?:\.\/)+/, '')
    );
    return extensionOf(path) ? path : `${path}.tex`;
};

export function texEntryPointStatus(
    segments: ReadonlyArray<Segment>,
    filePath: string
): TexEntryPointStatus {
    const path = normalizeProjectFilePath(filePath);
    if (path.toLowerCase() === SERVER_MAIN_FILE) {
        return { kind: 'replacedByMain' };
    }
    for (const [segmentIndex, segment] of segments.entries()) {
        if (segment.type !== 'latex') {
            continue;
        }
        const lines = segment.text.split('\n');
        for (const [lineIndex, line] of lines.entries()) {
            for (const match of withoutComment(line).matchAll(
                INCLUDE_COMMAND
            )) {
                if (includedPath(match[1]) === path) {
                    return {
                        kind: 'included',
                        segmentIndex,
                        line: lineIndex + 1,
                    };
                }
            }
        }
    }
    return { kind: 'notIncluded' };
}

/** Строка, которой подключается файл. Путь как в проекте: файлы лежат рядом с main.tex */
export const texIncludeLine = (filePath: string): string =>
    `\\input{${normalizeProjectFilePath(filePath)}}`;
