import { ProjectShort } from '../../model/domain.ts';
import { RequestResult } from '../../model/rpi';
import { ViewModelRepository } from '../repository';

/** Поля проекта, которые меняются прямо из списка */
export type ListedField = 'title' | 'tags' | 'public';

const LISTED_FIELDS: ListedField[] = ['title', 'tags', 'public'];

/** Ответ на правку, которую отправлять не пришлось: сервер уже хранит то же */
export const NOTHING_TO_SEND: RequestResult<never> = {
    body: undefined as never,
    code: 200,
    isOk: true,
    isUnauth: false,
    isForbidden: false,
};

/** Итог оптимистичной правки: ответ сервера и пропало ли что-то из задуманного */
export interface WriteOutcome<R> {
    result: R;
    /**
     * Серия правок поля закончилась, и итог расходится с тем, что вышло бы,
     * пройди они все. Решается один раз на серию, последней правкой: подряд
     * идущие отказы дают одно сообщение, а отказ, который следующая правка
     * всё равно перекрыла, не даёт ни одного
     */
    lost: boolean;
}

/** Правки одного поля проекта, ещё не завершённые, поверх принятого сервером */
interface FieldSeries<T> {
    confirmed: T;
    pending: ((value: T) => T)[];
    /** Что вышло бы, пройди все правки этой серии */
    intended: T;
    /** Сервер отказал хотя бы одной правке серии (не из-за сессии) */
    failed: boolean;
}

export interface OptimisticWrite<T, R extends RequestResult<unknown>> {
    /** Что поле показывает сейчас */
    current: T;
    /** Правка как функция от того, что хранит сервер */
    change: (value: T) => T;
    same: (a: T, b: T) => boolean;
    /** Показать значение в списке */
    apply: (value: T) => void;
    send: (value: T) => Promise<R>;
    /** Что сервер принял: ответ или отправленное */
    accepted: (result: R, sent: T) => T;
    /** Как сравнить итог серии с задуманным; по умолчанию same */
    sameOutcome?: (a: T, b: T) => boolean;
}

/**
 * Незавершённые правки полей проектов из списка: название, метки, доступ.
 * Раньше это жило в трёх местах (учёт идущих правок в LoaderService, очередь
 * и оптимистичные серии в ProjectsPageService, своя очередь переименований в
 * ProjectPageService), и каждое делало часть одной работы. Здесь всё сразу:
 *
 * - запросы к одному полю уходят по очереди, сервер получает их по порядку;
 * - список с сервера, запрошенный раньше, чем правка поля закончилась, это
 *   поле не трогает: ответ мог уйти до того, как сервер её принял;
 * - оптимистичная правка видна сразу, а отказ откатывает только её;
 * - удачная запись двигает lastModified проекта, как это делает сервер
 */
export class ProjectListWrites {
    /** Общие часы правок и запросов списка: по ним видно, что было раньше */
    private clock = 0;
    private pending = new Map<string, number>();
    private settledAt = new Map<string, number>();
    private queues = new Map<string, Promise<unknown>>();
    private series = new Map<string, FieldSeries<unknown>>();

    constructor(private repository: ViewModelRepository) {}

    /** Отметка часов, например для запроса списка */
    tick = (): number => ++this.clock;

    /** Идёт ли оптимистичная серия правок поля */
    isWriting = (projectId: string, field: ListedField): boolean =>
        this.series.has(fieldKey(projectId, field));

    /**
     * Запрос к полю после всех прежних к нему же. Пока он идёт, список с
     * сервера это поле не трогает. Удачный ответ двигает время изменения
     */
    run = async <R extends RequestResult<unknown>>(
        projectId: string,
        field: ListedField,
        send: () => Promise<R>
    ): Promise<R> => {
        const key = fieldKey(projectId, field);
        this.started(key);
        try {
            const result = await this.enqueue(key, send);
            if (result.isOk) {
                this.touch(projectId);
            }
            return result;
        } finally {
            this.settled(key);
        }
    };

    /**
     * Оптимистичная правка. Правка применяется к тому, что хранит сервер, в
     * момент отправки: так отказ по одной правке не уезжает на сервер в
     * составе следующей. В списке сразу видны все незавершённые правки поверх
     * принятого сервером
     */
    optimistic = async <T, R extends RequestResult<unknown>>(
        projectId: string,
        field: ListedField,
        write: OptimisticWrite<T, R>
    ): Promise<WriteOutcome<R>> => {
        const key = fieldKey(projectId, field);
        const state = (this.series.get(key) ?? {
            confirmed: write.current,
            pending: [],
            intended: write.current,
            failed: false,
        }) as FieldSeries<T>;
        state.intended = write.change(state.intended);
        this.series.set(key, state as FieldSeries<unknown>);
        const show = () =>
            write.apply(
                state.pending.reduce(
                    (value, pending) => pending(value),
                    state.confirmed
                )
            );
        state.pending.push(write.change);
        show();
        this.started(key);

        let result: R;
        try {
            result = await this.enqueue(key, async () => {
                const next = write.change(state.confirmed);
                if (write.same(next, state.confirmed)) {
                    return NOTHING_TO_SEND as unknown as R;
                }
                const sent = await write.send(next);
                if (sent.isOk) {
                    state.confirmed = write.accepted(sent, next);
                    this.touch(projectId);
                } else if (!sent.isUnauth) {
                    state.failed = true;
                }
                return sent;
            });
        } finally {
            // и при исключении: иначе поле проекта в этой вкладке навсегда
            // считалось бы занятым правкой и перестало обновляться из списка
            state.pending.splice(state.pending.indexOf(write.change), 1);
            show();
            if (!state.pending.length && this.series.get(key) === state) {
                this.series.delete(key);
            }
            this.settled(key);
        }
        const last = !state.pending.length;
        const sameOutcome = write.sameOutcome ?? write.same;
        return {
            result,
            lost:
                last &&
                state.failed &&
                !sameOutcome(state.confirmed, state.intended),
        };
    };

    /**
     * Поля, которые правят сейчас или поправили после того, как ушёл запрос
     * списка, берутся из показанного списка, а не из ответа. Вместе с ними и
     * время изменения: в ответе оно ещё старое
     */
    keepLocalFields = (
        projects: ProjectShort[],
        requestedAt: number
    ): ProjectShort[] => {
        const local = new Map(
            this.repository.projectsViewModelRepository
                .projects()
                .map((project) => [project.projectId, project])
        );
        const fresh = (projectId: string, field: ListedField) => {
            const key = fieldKey(projectId, field);
            return (
                !this.pending.has(key) &&
                (this.settledAt.get(key) ?? 0) < requestedAt
            );
        };
        return projects.map((project) => {
            const own = local.get(project.projectId);
            if (!own) {
                return project;
            }
            const stale = LISTED_FIELDS.filter(
                (field) => !fresh(project.projectId, field)
            );
            if (!stale.length) {
                return project;
            }
            const patch: Partial<ProjectShort> = {
                lastModified: own.lastModified,
            };
            if (stale.includes('tags')) {
                patch.tags = own.tags;
            }
            if (stale.includes('public')) {
                patch.isPublic = own.isPublic;
            }
            if (stale.includes('title')) {
                patch.title = own.title;
            }
            return { ...project, ...patch };
        });
    };

    private enqueue = <T>(key: string, send: () => Promise<T>): Promise<T> => {
        const previous = this.queues.get(key) ?? Promise.resolve();
        const request = previous.then(send, send);
        this.queues.set(key, request);
        const cleanup = () => {
            if (this.queues.get(key) === request) {
                this.queues.delete(key);
            }
        };
        request.then(cleanup, cleanup);
        return request;
    };

    private started = (key: string) => {
        this.pending.set(key, (this.pending.get(key) ?? 0) + 1);
    };

    private settled = (key: string) => {
        const left = (this.pending.get(key) ?? 1) - 1;
        if (left > 0) {
            this.pending.set(key, left);
        } else {
            this.pending.delete(key);
        }
        this.settledAt.set(key, this.tick());
    };

    /** Сервер двигает lastModified на каждой записи (спека, ProjectSpec) */
    private touch = (projectId: string) => {
        const projects = this.repository.projectsViewModelRepository;
        const now = new Date().toISOString();
        projects.setProjects(
            projects
                .projects()
                .map((project) =>
                    project.projectId === projectId
                        ? { ...project, lastModified: now }
                        : project
                )
        );
    };
}

const fieldKey = (projectId: string, field: ListedField) =>
    `${projectId}:${field}`;
