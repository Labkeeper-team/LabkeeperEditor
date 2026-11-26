import { ViewModelRepository } from '../repository';
import {
    Events,
    ObserverService,
} from '../../model/service/ObserverService.ts';
import { trackEvent } from '../utils/observerContext.ts';
import {
    agentChangeRanges,
    type AgentChangeRange,
} from '../utils/agentChangeRanges.ts';
import type {
    AgentPdfMark,
    AgentPdfMarkLocator,
} from '../domain/AgentPdfMarkLocator.ts';

/**
 * Свежих правок больше этого не ищем: на каждую уходит до трёх запросов
 * навигации, пока сервер не отдаёт места всех правок разом
 */
const MAX_RANGES = 30;

/** Правка с теми же строками в том же месте: id ханка сервер сохраняет и после пересчёта мест */
const rangeKey = (range: AgentChangeRange): string =>
    `${range.hunkId}:${range.file ?? range.segmentId}:${range.startLine}-${range.endLine}`;

/**
 * GH-190: правки агента отмечаются зелёным поверх PDF. После каждой сборки и
 * при входе в проект места правок ищутся заново, найденные для того же PDF
 * не ищутся второй раз. Принятая или откаченная правка пропадает из отметок
 * без запросов
 */
export class AgentPdfMarksService {
    /** Места правок в нынешнем PDF, null у правки, о строках которой сервер не знает */
    private cache: {
        pdfUri: string;
        marks: Map<string, AgentPdfMark | null>;
    } | null = null;
    private running: Promise<void> = Promise.resolve();
    private queued: Promise<void> | null = null;

    constructor(
        private repository: ViewModelRepository,
        private locator: AgentPdfMarkLocator,
        private observerService: ObserverService
    ) {}

    /**
     * Звать при любой смене PDF, правок или прогона агента. Вызовы во время
     * поиска склеиваются в один следующий
     */
    refresh = (): Promise<void> => {
        if (this.queued) {
            return this.queued;
        }
        const run = this.running.then(() => {
            this.queued = null;
            return this.refreshOnce();
        });
        this.queued = run;
        this.running = run.catch(() => undefined);
        return run;
    };

    /** Отмечать можно то же, к чему ведёт навигация: свой LaTeX-проект, собранный в PDF */
    private projectToMark = (): {
        projectId: string;
        pdfUri: string;
    } | null => {
        const projects = this.repository.projectViewModelRepository;
        const projectId = projects.project()?.projectId;
        const pdfUri = projects.pdfUri();
        if (
            !this.repository.userViewModelRepository.isAuthenticated() ||
            projects.projectIsReadonly() ||
            projects.mode() !== 'latex' ||
            !projectId ||
            !pdfUri
        ) {
            return null;
        }
        return { projectId, pdfUri };
    };

    private currentRanges = (): AgentChangeRange[] =>
        agentChangeRanges(
            this.repository.ideViewModelRepository.hunks(),
            this.repository.projectViewModelRepository.currentProgram()
                ?.segments ?? []
        ).slice(-MAX_RANGES);

    private publish = (): void => {
        const cache = this.cache;
        this.repository.ideViewModelRepository.setAgentPdfMarks(
            cache
                ? {
                      pdfUri: cache.pdfUri,
                      marks: this.currentRanges().flatMap(
                          (range) => cache.marks.get(rangeKey(range)) ?? []
                      ),
                  }
                : null
        );
    };

    private refreshOnce = async (): Promise<void> => {
        const target = this.projectToMark();
        if (!target) {
            this.cache = null;
            this.publish();
            return;
        }
        if (this.cache?.pdfUri !== target.pdfUri) {
            this.cache = { pdfUri: target.pdfUri, marks: new Map() };
        }
        const cache = this.cache;
        const missing = this.currentRanges().filter(
            (range) => !cache.marks.has(rangeKey(range))
        );
        this.publish();
        // во время прогона проект занят и PDF вот-вот сменится: ищем после него
        const requestState =
            this.repository.chatViewModelRepository.requestState();
        if (
            missing.length === 0 ||
            requestState === 'connecting' ||
            requestState === 'running'
        ) {
            return;
        }

        const ide = this.repository.ideViewModelRepository;
        ide.setAgentPdfMarksLoading(true);
        const startedAt = Date.now();
        try {
            const lookup = await this.locator.locate(target.projectId, missing);
            const projects = this.repository.projectViewModelRepository;
            // пока шли запросы, сменился проект или PDF: эти места уже ни к чему
            if (
                projects.pdfUri() !== target.pdfUri ||
                projects.project()?.projectId !== target.projectId
            ) {
                return;
            }
            const keys = new Map(
                missing.map((range) => [range.hunkId, rangeKey(range)])
            );
            if (lookup.outcome === 'located') {
                for (const { hunkId, mark } of lookup.marks) {
                    const key = keys.get(hunkId);
                    if (key) {
                        cache.marks.set(key, mark);
                    }
                }
            }
            trackEvent(
                this.observerService,
                this.repository,
                Events.EVENT_AGENT_PDF_MARKS,
                {
                    outcome: lookup.outcome,
                    hunk_count: missing.length,
                    marked:
                        lookup.outcome === 'located'
                            ? lookup.marks.filter((item) => item.mark).length
                            : 0,
                    requests: lookup.requests,
                    duration_ms: Date.now() - startedAt,
                    ...(lookup.outcome === 'unavailable'
                        ? { code: lookup.code }
                        : {}),
                }
            );
        } finally {
            ide.setAgentPdfMarksLoading(false);
        }
        this.publish();
    };
}
