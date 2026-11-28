import type { PdfPosition, Rpi } from '../../model/rpi';
import type { AgentChangeRange } from '../utils/agentChangeRanges.ts';

/**
 * GH-190: где в собранном PDF лежит правка агента: от верхнего края первой
 * строки до нижнего края последней. y в pt от верха страницы. Нижний край
 * может выйти за страницу: так SyncTeX отвечает про строки, после которых на
 * странице ничего нет, и экран тогда прижимает край к тексту страницы
 */
export interface AgentPdfMark {
    hunkId: string;
    top: PdfPosition;
    bottom: PdfPosition;
}

/** Места правок вместе с адресом PDF, в котором их нашли: к другому PDF они не подходят */
export interface AgentPdfMarks {
    pdfUri: string;
    marks: AgentPdfMark[];
}

export type AgentPdfMarkLookup =
    | {
          outcome: 'located';
          /** На каждую правку: место в PDF или null, если сервер о её строках не знает */
          marks: { hunkId: string; mark: AgentPdfMark | null }[];
          requests: number;
      }
    | {
          /** Нет доступа или проект занят: спрашивать про остальные правки бессмысленно */
          outcome: 'unavailable';
          code: number;
          requests: number;
      };

/**
 * Откуда берутся места правок в PDF. Сейчас из навигации SyncTeX, по запросу
 * на строку. Сервер обещал отдавать места всех правок одним запросом: тогда
 * здесь появится вторая реализация, а context.ts подставит её вместо
 * NavigationMarkLocator. Сервис и экран при этом не меняются
 */
export interface AgentPdfMarkLocator {
    locate(
        projectId: string,
        ranges: AgentChangeRange[]
    ): Promise<AgentPdfMarkLookup>;
}

/**
 * Высота строки над базовой линией и под ней, pt. Навигация отдаёт базовую
 * линию, а отметка должна закрыть буквы целиком
 */
export const LINE_ASCENT_PT = 12;
export const LINE_DESCENT_PT = 4;

/**
 * Строка исходника отвечает за свою первую строку в PDF, а длинный абзац
 * занимает несколько. Поэтому низ правки ищется по строке после неё, если
 * та начинается недалеко. Дальше это уже другой текст или пустое место
 */
const MAX_TAIL_PT = 120;

/** Ответы, после которых спрашивать про остальные правки бессмысленно. 410 сервер отдаёт и на строку чужого файла, поэтому он не здесь */
const STOP_CODES = new Set([401, 403, 423]);

/** Запросов навигации одновременно: правок бывает несколько десятков */
const CONCURRENCY = 4;

class LookupStopped extends Error {
    constructor(readonly code: number) {
        super(`navigation stopped with ${code}`);
    }
}

/**
 * Места правок по запросам навигации: первая строка правки, последняя и
 * строка сразу после неё. На строку без своего вывода (пустую, комментарий,
 * \begin) сервер отвечает местом следующего текста, так что промахов нет
 */
export class NavigationMarkLocator implements AgentPdfMarkLocator {
    constructor(private rpi: Rpi) {}

    async locate(
        projectId: string,
        ranges: AgentChangeRange[]
    ): Promise<AgentPdfMarkLookup> {
        let requests = 0;
        let stopCode: number | null = null;

        const positionOf = async (
            range: AgentChangeRange,
            line: number
        ): Promise<PdfPosition | null> => {
            if (stopCode !== null) {
                throw new LookupStopped(stopCode);
            }
            requests += 1;
            const result = await this.rpi.navigationDocToPdfRequest(
                projectId,
                range.file
                    ? { file: range.file, line }
                    : { segmentId: range.segmentId, line }
            );
            if (result.isOk && result.body) {
                return result.body;
            }
            if (STOP_CODES.has(result.code)) {
                stopCode ??= result.code;
                throw new LookupStopped(result.code);
            }
            return null;
        };

        const markOf = async (
            range: AgentChangeRange
        ): Promise<AgentPdfMark | null> => {
            const start = await positionOf(range, range.startLine);
            if (!start) {
                return null;
            }
            const end =
                range.endLine > range.startLine
                    ? ((await positionOf(range, range.endLine)) ?? start)
                    : start;
            const after = await positionOf(range, range.endLine + 1);
            const tailEnds =
                after &&
                after.page === end.page &&
                after.y > end.y &&
                after.y - end.y <= MAX_TAIL_PT;
            return {
                hunkId: range.hunkId,
                top: { ...start, y: start.y - LINE_ASCENT_PT },
                bottom: tailEnds
                    ? { ...after, y: after.y - LINE_ASCENT_PT }
                    : { ...end, y: end.y + LINE_DESCENT_PT },
            };
        };

        try {
            const marks = await mapWithConcurrency(
                ranges,
                CONCURRENCY,
                async (range) => ({
                    hunkId: range.hunkId,
                    mark: await markOf(range),
                })
            );
            return { outcome: 'located', marks, requests };
        } catch (error) {
            if (error instanceof LookupStopped) {
                return { outcome: 'unavailable', code: error.code, requests };
            }
            throw error;
        }
    }
}

/** map с ограничением одновременных вызовов, порядок результатов как у входа */
async function mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    map: (item: T) => Promise<R>
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const index = next++;
            results[index] = await map(items[index]);
        }
    };
    await Promise.all(
        Array.from({ length: Math.min(limit, items.length) }, worker)
    );
    return results;
}
