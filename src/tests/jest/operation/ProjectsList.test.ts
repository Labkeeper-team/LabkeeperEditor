import { ProjectShort } from '../../../model/domain.ts';
import { RequestResult } from '../../../model/rpi';
import { Events } from '../../../model/service/ObserverService.ts';
import { MockViewModelRepository } from '../../../viewModel/repository';
import {
    normalizeProjectTags,
    tagsChange,
} from '../../../viewModel/operation/ProjectsPageService.ts';
import {
    DEFAULT_SORT,
    EMPTY_FILTER,
    collectTags,
    defaultTagColor,
    isFilterActive,
    uniqueTags,
    matchesFilter,
    sortProjects,
} from '../../../viewModel/domain/projectsFilter.ts';
import { tagColors } from '../../../view/pages/projects/tagColors.ts';
import { mockContext, USER_ID } from '../common.ts';

const collator = new Intl.Collator(['en', 'ru'], {
    sensitivity: 'base',
    numeric: true,
});

const project = (
    id: string,
    patch: Partial<ProjectShort> = {}
): ProjectShort => ({
    projectId: id,
    userId: USER_ID,
    title: `Project ${id}`,
    lastModified: '2025-01-01T00:00:00Z',
    creationTime: '2024-01-01T00:00:00Z',
    isPublic: false,
    projectType: 'latex',
    tags: [],
    ...patch,
});

const ok = <T extends object>(body: T, code = 200): RequestResult<T> => ({
    body,
    code,
    isOk: true,
    isUnauth: false,
    isForbidden: false,
});

const fail = (code: number): RequestResult<object> => ({
    body: {},
    code,
    isOk: false,
    isUnauth: code === 401,
    isForbidden: code === 403,
});

const PHYSICS = { name: 'Физика', color: '#4469e0' };
const THESIS = { name: 'Диплом', color: '#1ca852' };

const LIST = [
    project('a', {
        title: 'Лабораторная 2',
        tags: [PHYSICS],
        lastModified: '2025-03-01T00:00:00Z',
        creationTime: '2024-05-01T00:00:00Z',
    }),
    project('b', {
        title: 'Лабораторная 10',
        tags: [PHYSICS, THESIS],
        isPublic: true,
        lastModified: '2025-01-01T00:00:00Z',
        creationTime: '2024-09-01T00:00:00Z',
    }),
    project('c', {
        title: 'Notes',
        projectType: 'markdown',
        lastModified: '2025-02-01T00:00:00Z',
        creationTime: '2024-01-01T00:00:00Z',
    }),
];

const ids = (projects: ProjectShort[]) => projects.map((p) => p.projectId);
const filtered = (patch: Partial<typeof EMPTY_FILTER>) =>
    ids(LIST.filter((p) => matchesFilter(p, { ...EMPTY_FILTER, ...patch })));

test('projects-filter-search-matches-every-word-in-title-or-tags', () => {
    expect(filtered({ search: 'лаб физ' })).toEqual(['a', 'b']);
    expect(filtered({ search: 'диплом' })).toEqual(['b']);
    expect(filtered({ search: '  NOTES ' })).toEqual(['c']);
    expect(filtered({ search: 'лаб notes' })).toEqual([]);
});

test('projects-filter-by-tag-untagged-type-and-access', () => {
    expect(filtered({ tag: 'физика' })).toEqual(['a', 'b']);
    expect(filtered({ tag: 'диплом' })).toEqual(['b']);
    expect(filtered({ untagged: true })).toEqual(['c']);
    expect(filtered({ type: 'markdown' })).toEqual(['c']);
    expect(filtered({ access: 'public' })).toEqual(['b']);
    expect(filtered({ access: 'private' })).toEqual(['a', 'c']);
});

test('projects-filter-is-active-only-when-something-is-set', () => {
    expect(isFilterActive(EMPTY_FILTER)).toBe(false);
    expect(isFilterActive({ ...EMPTY_FILTER, search: '   ' })).toBe(false);
    expect(isFilterActive({ ...EMPTY_FILTER, access: 'public' })).toBe(true);
});

test('projects-sort-by-title-is-numeric-and-by-dates-is-chronological', () => {
    expect(
        ids(sortProjects(LIST, { field: 'title', direction: 'asc' }, collator))
    ).toEqual(['c', 'a', 'b']);
    expect(ids(sortProjects(LIST, DEFAULT_SORT, collator))).toEqual([
        'a',
        'c',
        'b',
    ]);
    expect(
        ids(
            sortProjects(LIST, { field: 'created', direction: 'asc' }, collator)
        )
    ).toEqual(['c', 'a', 'b']);
});

test('projects-tags-are-collected-case-insensitively-most-used-first', () => {
    const tags = collectTags(
        [...LIST, project('d', { tags: [{ name: 'диплом', color: 'red' }] })],
        collator
    );
    expect(tags.map((t) => [t.name, t.count])).toEqual([
        ['Диплом', 2],
        ['Физика', 2],
    ]);
});

// сервер не ограничивает число, длину и регистр меток: сохранение их не теряет
test('projects-tags-normalization-keeps-everything-the-server-allows', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
        name: `t${i}`,
        color: '#000000',
    }));
    expect(normalizeProjectTags(many)).toEqual(many);
    expect(
        normalizeProjectTags([
            { name: '  Физика ', color: '#4469e0' },
            { name: 'физика', color: '#000000' },
            { name: 'Физика', color: '#111111' },
            { name: '   ', color: '#000000' },
            { name: 'x'.repeat(50), color: '#000000' },
        ])
    ).toEqual([
        { name: 'Физика', color: '#4469e0' },
        { name: 'физика', color: '#000000' },
        { name: 'x'.repeat(50), color: '#000000' },
    ]);
    expect(defaultTagColor('Физика')).toBe(defaultTagColor(' физика'));
});

test('tag-colors-pick-readable-text-and-borders', () => {
    expect(tagColors('#ffffff')).toMatchObject({
        dot: '#ffffff',
        activeText: '#0e1621',
        border: '#bfc8de',
    });
    expect(tagColors('#4469e0').activeText).toBe('#ffffff');
    expect(tagColors('#FFF').dot).toBe('#ffffff');
    // не-hex в jsdom не разобрать: берётся серый из палитры, а не пустота
    expect(tagColors('').dot).toBe('#8c98b0');
});

const lastToast = (ctx: {
    toasts: () => { message: string; type: unknown }[];
}) => ctx.toasts()[ctx.toasts().length - 1];

const setup = () => {
    const ctx = mockContext();
    ctx.repository.projectsViewModelRepository.setProjects(LIST);
    const toasts = () =>
        (ctx.repository as MockViewModelRepository).mockState().toasts;
    const listed = (id: string) =>
        ctx.repository.projectsViewModelRepository
            .projects()
            .find((p) => p.projectId === id)!;
    return { ...ctx, toasts, listed };
};

test('project-tags-change-saves-normalized-tags-and-updates-the-list', async () => {
    const ctx = setup();
    const onEvent = jest.spyOn(ctx.observerService, 'onEvent');
    ctx.rpi.setProjectTagsRequest = jest
        .fn()
        .mockImplementation(async (_id, tags) => ok({ tags }));

    await ctx.projectsPageService.onProjectTagsChange('c', [
        { name: ' Черновик ', color: '#e0a100' },
    ]);

    expect(ctx.rpi.setProjectTagsRequest).toHaveBeenCalledWith('c', [
        { name: 'Черновик', color: '#e0a100' },
    ]);
    expect(ctx.listed('c').tags).toEqual([
        { name: 'Черновик', color: '#e0a100' },
    ]);
    expect(onEvent).toHaveBeenCalledWith(
        Events.EVENT_PROJECT_TAGS_CHANGED,
        expect.objectContaining({ project_id: 'c', tags_count: 1 })
    );
});

test('project-tags-change-rolls-back-when-the-server-refuses', async () => {
    const ctx = setup();
    ctx.rpi.setProjectTagsRequest = jest.fn().mockResolvedValue(fail(500));

    await ctx.projectsPageService.onProjectTagsChange('a', []);

    expect(ctx.listed('a').tags).toEqual([PHYSICS]);
    expect(lastToast(ctx)).toEqual({
        message: ctx.repository.dictionary.projects.errors.tags_failed,
        type: 'error',
    });
});

test('listed-project-visibility-changes-in-place-and-rolls-back-on-error', async () => {
    const ctx = setup();
    ctx.rpi.setProjectVisibilityRequest = jest
        .fn()
        .mockResolvedValueOnce(ok({}))
        .mockResolvedValueOnce(fail(500));

    await ctx.projectsPageService.onListedProjectVisibilityChange('a', true);
    expect(ctx.listed('a').isPublic).toBe(true);
    expect(ctx.rpi.setProjectVisibilityRequest).toHaveBeenCalledWith('a', true);

    await ctx.projectsPageService.onListedProjectVisibilityChange('a', false);
    expect(ctx.listed('a').isPublic).toBe(true);
    expect(lastToast(ctx)?.type).toBe('error');
});

// доступ меняется в списке сразу, ещё до ответа сервера
test('listed-project-visibility-shows-at-once-and-rolls-back-on-refusal', async () => {
    const ctx = setup();
    const answer = deferred<RequestResult<object>>();
    ctx.rpi.setProjectVisibilityRequest = jest
        .fn()
        .mockReturnValue(answer.promise);

    const change = ctx.projectsPageService.onListedProjectVisibilityChange(
        'a',
        true
    );
    expect(ctx.listed('a').isPublic).toBe(true);

    answer.resolve(fail(500));
    await change;
    expect(ctx.listed('a').isPublic).toBe(false);
});

test('duplicate-project-clones-it-and-reloads-the-list-without-navigation', async () => {
    const ctx = setup();
    const copy = project('copy', { title: 'Лабораторная 2 (copy)' });
    ctx.rpi.cloneProjectRequest = jest
        .fn()
        .mockResolvedValue(ok({ ...copy, program: {} }, 201));
    // сервер отдаёт старые проекты первыми, как и для loadProjects
    ctx.rpi.getAllProjectsRequest = jest
        .fn()
        .mockResolvedValue(ok({ projects: [...LIST].reverse().concat(copy) }));
    const setLocation = jest.spyOn(ctx.repository, 'setLocation');

    await ctx.projectsPageService.onDuplicateProject('a');

    expect(ctx.rpi.cloneProjectRequest).toHaveBeenCalledWith('a');
    expect(
        ctx.repository.projectsViewModelRepository
            .projects()
            .map((p) => p.projectId)
    ).toEqual(['copy', 'a', 'b', 'c']);
    expect(setLocation).not.toHaveBeenCalled();
    expect(lastToast(ctx)?.type).toBe('success');
});

test('a-second-click-while-copying-does-not-make-a-second-copy', async () => {
    const ctx = setup();
    const copy = project('copy');
    let answer: (value: RequestResult<object>) => void = () => {};
    ctx.rpi.cloneProjectRequest = jest
        .fn()
        .mockReturnValue(new Promise((resolve) => (answer = resolve)));
    ctx.rpi.getAllProjectsRequest = jest
        .fn()
        .mockResolvedValue(ok({ projects: [...LIST].reverse().concat(copy) }));

    const first = ctx.projectsPageService.onDuplicateProject('a');
    const second = ctx.projectsPageService.onDuplicateProject('a');
    answer(ok({ ...copy, program: {} }, 201));
    await Promise.all([first, second]);

    expect(ctx.rpi.cloneProjectRequest).toHaveBeenCalledTimes(1);
});

// список после копии не пришёл: копия всё равно видна, раз о ней сказали
test('a-copy-is-listed-even-when-the-next-list-fails', async () => {
    const ctx = setup();
    const copy = project('copy', { title: 'Лабораторная 2 (copy)' });
    ctx.rpi.cloneProjectRequest = jest
        .fn()
        .mockResolvedValue(ok({ ...copy, program: {} }, 201));
    ctx.rpi.getAllProjectsRequest = jest.fn().mockResolvedValue(fail(500));

    await ctx.projectsPageService.onDuplicateProject('a');

    expect(ctx.listed('copy')?.title).toBe('Лабораторная 2 (copy)');
    expect(lastToast(ctx)?.type).toBe('success');
});

// проект удалили в другой вкладке: правка ему уже не нужна, и в списке ему не место
test.each([
    [
        'tags',
        (ctx: ReturnType<typeof setup>) =>
            ctx.projectsPageService.onProjectTagsChange('c', [
                { name: 'X', color: '#000000' },
            ]),
    ],
    [
        'visibility',
        (ctx: ReturnType<typeof setup>) =>
            ctx.projectsPageService.onListedProjectVisibilityChange('c', true),
    ],
])(
    'a-%s-change-of-a-deleted-project-removes-it-from-the-list',
    async (_field, change) => {
        const ctx = setup();
        ctx.rpi.setProjectTagsRequest = jest.fn().mockResolvedValue(fail(404));
        ctx.rpi.setProjectVisibilityRequest = jest
            .fn()
            .mockResolvedValue(fail(404));

        await change(ctx);

        expect(ctx.listed('c')).toBeUndefined();
        expect(lastToast(ctx)?.message).toBe(
            ctx.repository.dictionary.filemanager.errors.notFound
        );
    }
);

test('duplicate-project-reports-the-project-limit', async () => {
    const ctx = setup();
    ctx.rpi.cloneProjectRequest = jest.fn().mockResolvedValue(fail(417));

    await ctx.projectsPageService.onDuplicateProject('a');

    expect(lastToast(ctx)?.message).toBe(
        ctx.repository.dictionary.new_project.error.too_many_projects
    );
});

test('download-project-saves-the-archive-under-the-project-title', async () => {
    const ctx = setup();
    ctx.rpi.exportProjectRequest = jest
        .fn()
        .mockResolvedValue(ok('https://files/tmp/x.zip' as never, 201));
    const download = jest.spyOn(ctx.repository, 'downloadFile');

    await ctx.projectsPageService.onDownloadProject('a');

    expect(download).toHaveBeenCalledWith(
        'https://files/tmp/x.zip',
        'Лабораторная 2.zip'
    );
});

const echoTags = () =>
    jest
        .fn()
        .mockImplementation(async (_id: string, tags: unknown) => ok({ tags }));

const tagNames = (ctx: ReturnType<typeof setup>, id: string) =>
    (ctx.listed(id).tags ?? []).map((t) => `${t.name}:${t.color}`);

test('tag-save-renames-and-recolors-in-place-and-syncs-membership', async () => {
    const ctx = setup();
    ctx.rpi.setProjectTagsRequest = echoTags();

    // «Физика» была у a и b; теперь «Физ» у a и c
    await ctx.projectsPageService.onTagSave({
        previousName: 'Физика',
        name: 'Физ',
        color: '#e5533d',
        projectIds: ['a', 'c'],
    });

    expect(tagNames(ctx, 'a')).toEqual(['Физ:#e5533d']);
    expect(tagNames(ctx, 'b')).toEqual(['Диплом:#1ca852']);
    expect(tagNames(ctx, 'c')).toEqual(['Физ:#e5533d']);
    expect(ctx.rpi.setProjectTagsRequest).toHaveBeenCalledTimes(3);
});

test('tag-save-keeps-the-tag-position-among-others', async () => {
    const ctx = setup();
    ctx.rpi.setProjectTagsRequest = echoTags();

    await ctx.projectsPageService.onTagSave({
        previousName: 'Физика',
        name: 'Физика',
        color: '#000000',
        projectIds: ['a', 'b'],
    });

    expect(tagNames(ctx, 'b')).toEqual(['Физика:#000000', 'Диплом:#1ca852']);
});

test('tag-delete-removes-it-everywhere-and-rolls-back-failed-projects', async () => {
    const ctx = setup();
    ctx.rpi.setProjectTagsRequest = jest
        .fn()
        .mockImplementation(async (id: string, tags: unknown) =>
            id === 'b' ? fail(500) : ok({ tags })
        );

    await ctx.projectsPageService.onTagDelete('физика');

    expect(tagNames(ctx, 'a')).toEqual([]);
    expect(tagNames(ctx, 'b')).toEqual(['Физика:#4469e0', 'Диплом:#1ca852']);
    expect(ctx.rpi.setProjectTagsRequest).toHaveBeenCalledTimes(2);
    expect(lastToast(ctx)?.message).toBe(
        ctx.repository.dictionary.projects.errors.tags_failed
    );
});

const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => (resolve = r));
    return { promise, resolve };
};

test('saving-tags-of-a-project-with-many-tags-keeps-them-all', async () => {
    const ctx = setup();
    const many = Array.from({ length: 12 }, (_, i) => ({
        name: `t${i}`,
        color: '#000000',
    }));
    ctx.repository.projectsViewModelRepository.setProjects([
        project('m', { tags: many }),
    ]);
    ctx.rpi.setProjectTagsRequest = echoTags();

    await ctx.projectsPageService.onTagSave({
        previousName: 't3',
        name: 't3',
        color: '#ffffff',
        projectIds: ['m'],
    });

    expect(ctx.rpi.setProjectTagsRequest).toHaveBeenCalledTimes(1);
    const sent = (ctx.rpi.setProjectTagsRequest as jest.Mock).mock.calls[0][1];
    expect(sent).toHaveLength(12);
    expect(sent[3]).toEqual({ name: 't3', color: '#ffffff' });
});

test('unchanged-project-tags-are-not-sent', async () => {
    const ctx = setup();
    ctx.rpi.setProjectTagsRequest = echoTags();

    await ctx.projectsPageService.onProjectTagsChange('a', [PHYSICS]);

    expect(ctx.rpi.setProjectTagsRequest).not.toHaveBeenCalled();
});

test('new-tag-is-not-added-where-the-limit-is-reached-and-says-so', async () => {
    const ctx = setup();
    const ten = Array.from({ length: 10 }, (_, i) => ({
        name: `t${i}`,
        color: '#000000',
    }));
    ctx.repository.projectsViewModelRepository.setProjects([
        project('full', { tags: ten }),
        project('free'),
    ]);
    ctx.rpi.setProjectTagsRequest = echoTags();

    await ctx.projectsPageService.onTagSave({
        name: 'Новый',
        color: '#4469e0',
        projectIds: ['full', 'free'],
    });

    expect(ctx.rpi.setProjectTagsRequest).toHaveBeenCalledTimes(1);
    expect(tagNames(ctx, 'full')).toHaveLength(10);
    expect(tagNames(ctx, 'free')).toEqual(['Новый:#4469e0']);
    expect(lastToast(ctx)?.message).toBe(
        ctx.repository.dictionary.projects.tags_modal.limit.replace(
            '${max}',
            '10'
        )
    );
});

test('a-newer-tag-edit-keeps-its-own-change-but-not-a-refused-older-one', async () => {
    const ctx = setup();
    const first = deferred<RequestResult<object>>();
    const order: string[] = [];
    ctx.rpi.setProjectTagsRequest = jest
        .fn()
        .mockImplementation(async (_id: string, tags: { name: string }[]) => {
            order.push(tags.map((t) => t.name).join(','));
            return order.length === 1 ? first.promise : ok({ tags });
        });

    const older = ctx.projectsPageService.onProjectTagsChange('c', [
        { name: 'A', color: '#000000' },
    ]);
    const newer = ctx.projectsPageService.onProjectTagsChange('c', [
        { name: 'A', color: '#000000' },
        { name: 'B', color: '#000000' },
    ]);
    // вторая правка ждёт первую: сервер получает их по порядку
    await Promise.resolve();
    expect(order).toEqual(['A']);
    first.resolve(fail(500));
    await Promise.all([older, newer]);

    // вторая правка добавила только B: отказ по A с ней на сервер не уезжает
    expect(order).toEqual(['A', 'B']);
    expect(tagNames(ctx, 'c')).toEqual(['B:#000000']);
});

test('list-refresh-keeps-tags-that-are-still-being-saved', async () => {
    const ctx = setup();
    const save = deferred<RequestResult<object>>();
    ctx.rpi.setProjectTagsRequest = jest.fn().mockReturnValue(save.promise);
    ctx.rpi.cloneProjectRequest = jest
        .fn()
        .mockResolvedValue(ok({ ...project('copy'), program: {} }, 201));
    // сервер ещё не знает о новой метке у c
    ctx.rpi.getAllProjectsRequest = jest
        .fn()
        .mockResolvedValue(ok({ projects: [...LIST].reverse() }));

    const saving = ctx.projectsPageService.onProjectTagsChange('c', [
        { name: 'Новая', color: '#000000' },
    ]);
    await ctx.projectsPageService.onDuplicateProject('a');
    // список с сервером уже пришёл, а сохранение ещё идёт
    expect(ctx.rpi.getAllProjectsRequest).toHaveBeenCalledTimes(1);
    expect(tagNames(ctx, 'c')).toEqual(['Новая:#000000']);

    save.resolve(ok({ tags: [{ name: 'Новая', color: '#000000' }] }));
    await saving;
    expect(tagNames(ctx, 'c')).toEqual(['Новая:#000000']);
});

// архив Labkeeper по спеке не платный: незнакомый ответ это общий отказ, а замок агента свой
test('download-explains-a-lock-and-reports-other-errors-generally', async () => {
    const ctx = setup();
    ctx.rpi.exportProjectRequest = jest
        .fn()
        .mockResolvedValueOnce(fail(402))
        .mockResolvedValueOnce(fail(423));

    await ctx.projectsPageService.onDownloadProject('a');
    expect(lastToast(ctx)?.message).toBe(
        ctx.repository.dictionary.projects.errors.download_failed
    );
    await ctx.projectsPageService.onDownloadProject('a');
    expect(lastToast(ctx)?.message).toBe(
        ctx.repository.dictionary.projects.errors.project_busy
    );
});

test('a-refused-tag-change-is-not-saved-by-a-queued-sidebar-edit', async () => {
    const ctx = setup();
    const first = deferred<RequestResult<object>>();
    const sent: string[] = [];
    ctx.rpi.setProjectTagsRequest = jest
        .fn()
        .mockImplementation(async (id: string, tags: { name: string }[]) => {
            sent.push(`${id}:${tags.map((tag) => tag.name).join(',')}`);
            return sent.length === 1 ? first.promise : ok({ tags });
        });

    const refused = ctx.projectsPageService.onProjectTagsChange('a', [
        PHYSICS,
        { name: 'Новая', color: '#000000' },
    ]);
    const renamed = ctx.projectsPageService.onTagSave({
        previousName: 'Физика',
        name: 'Физ',
        color: PHYSICS.color,
        projectIds: ['a', 'b'],
    });
    // пока первая правка идёт, видны обе
    expect(tagNames(ctx, 'a')).toEqual(['Физ:#4469e0', 'Новая:#000000']);
    first.resolve(fail(500));
    await Promise.all([refused, renamed]);

    // переименование применилось к тому, что хранит сервер, без «Новой»
    expect(sent).toContain('a:Физ');
    expect(tagNames(ctx, 'a')).toEqual(['Физ:#4469e0']);
});

test('a-list-requested-before-a-save-finished-does-not-undo-it', async () => {
    const ctx = setup();
    const list = deferred<RequestResult<object>>();
    ctx.rpi.getAllProjectsRequest = jest.fn().mockReturnValue(list.promise);
    ctx.rpi.setProjectTagsRequest = echoTags();
    ctx.rpi.setProjectVisibilityRequest = jest.fn().mockResolvedValue(ok({}));

    const loading = ctx.projectsPageService.loaderService.loadProjects({
        silent: true,
    });
    await ctx.projectsPageService.onProjectTagsChange('c', [THESIS]);
    await ctx.projectsPageService.onListedProjectVisibilityChange('c', true);
    // ответ ушёл до сохранения: в нём старые метки и доступ
    list.resolve(ok({ projects: [...LIST].reverse() }));
    await loading;

    expect(tagNames(ctx, 'c')).toEqual(['Диплом:#1ca852']);
    expect(ctx.listed('c').isPublic).toBe(true);
});

test('an-older-list-response-does-not-replace-a-newer-one', async () => {
    const ctx = setup();
    const older = deferred<RequestResult<object>>();
    const renamed = LIST.map((p) =>
        p.projectId === 'a' ? { ...p, title: 'Новое имя' } : p
    );
    ctx.rpi.getAllProjectsRequest = jest
        .fn()
        .mockReturnValueOnce(older.promise)
        .mockResolvedValueOnce(ok({ projects: [...renamed].reverse() }));
    const loader = ctx.projectsPageService.loaderService;

    const first = loader.loadProjects({ silent: true });
    await loader.loadProjects({ silent: true });
    older.resolve(ok({ projects: [...LIST].reverse() }));
    await first;

    expect(ctx.listed('a').title).toBe('Новое имя');
});

test('renaming-from-the-list-trims-the-name-and-keeps-unsaved-tags', async () => {
    const ctx = setup();
    const save = deferred<RequestResult<object>>();
    ctx.rpi.setProjectTagsRequest = jest.fn().mockReturnValue(save.promise);
    ctx.rpi.setTitleRequest = jest.fn().mockResolvedValue(ok({}));
    // сервер уже знает новое имя, но ещё не знает новую метку
    const renamed = LIST.map((p) =>
        p.projectId === 'c' ? { ...p, title: 'Конспект' } : p
    );
    ctx.rpi.getAllProjectsRequest = jest
        .fn()
        .mockResolvedValue(ok({ projects: [...renamed].reverse() }));

    const saving = ctx.projectsPageService.onProjectTagsChange('c', [THESIS]);
    await ctx.projectPageService.onProjectTitleChanged(
        'c',
        '  Конспект  ',
        () => undefined,
        () => undefined
    );

    expect(ctx.rpi.setTitleRequest).toHaveBeenCalledWith('c', 'Конспект');
    expect(ctx.listed('c').title).toBe('Конспект');
    // список пришёл без метки, которая ещё сохраняется
    expect(tagNames(ctx, 'c')).toEqual(['Диплом:#1ca852']);
    save.resolve(ok({ tags: [THESIS] }));
    await saving;
});

test('a-failed-rename-says-so', async () => {
    const ctx = setup();
    ctx.rpi.setTitleRequest = jest.fn().mockResolvedValue(fail(500));
    const failCallback = jest.fn();

    await ctx.projectPageService.onProjectTitleChanged(
        'a',
        'Другое',
        () => undefined,
        failCallback
    );

    expect(failCallback).toHaveBeenCalled();
    expect(lastToast(ctx)?.message).toBe(
        ctx.repository.dictionary.projects.errors.rename_failed
    );
});

test('delete-is-sent-once-and-a-failure-is-reported', async () => {
    const ctx = setup();
    const answer = deferred<RequestResult<object>>();
    ctx.rpi.deleteProjectRequest = jest.fn().mockReturnValue(answer.promise);
    const closed = jest.fn();

    const first = ctx.projectsPageService.onDeleteProject('a', closed);
    await ctx.projectsPageService.onDeleteProject('a', closed);
    answer.resolve(fail(500));
    await first;

    expect(ctx.rpi.deleteProjectRequest).toHaveBeenCalledTimes(1);
    expect(closed).not.toHaveBeenCalled();
    expect(ctx.listed('a')).toBeDefined();
    expect(lastToast(ctx)?.message).toBe(
        ctx.repository.dictionary.projects.errors.delete_failed
    );
});

test('expired-session-on-the-list-is-not-shown-as-an-empty-list', async () => {
    const ctx = setup();
    ctx.rpi.setProjectTagsRequest = jest.fn().mockResolvedValue(fail(401));

    await ctx.projectsPageService.onProjectTagsChange('c', [THESIS]);

    expect(
        ctx.repository.ideViewModelRepository.getProjectsRequestState()
    ).toBe('unauth');
});

test('tags-are-counted-once-per-project-whatever-the-case', () => {
    const tags = collectTags(
        [
            project('x', {
                tags: [PHYSICS, { name: 'физика', color: '#000000' }, PHYSICS],
            }),
            project('y', { tags: [PHYSICS] }),
        ],
        collator
    );
    expect(tags.map((tag) => `${tag.name}:${tag.count}`)).toEqual(['Физика:2']);
    expect(uniqueTags([PHYSICS, PHYSICS, THESIS])).toEqual([PHYSICS, THESIS]);
});

test('a-list-requested-before-a-delete-does-not-bring-the-project-back', async () => {
    const ctx = setup();
    const older = deferred<RequestResult<object>>();
    ctx.rpi.getAllProjectsRequest = jest
        .fn()
        .mockReturnValueOnce(older.promise)
        .mockResolvedValueOnce(fail(500));
    ctx.rpi.deleteProjectRequest = jest.fn().mockResolvedValue(ok({}));

    const loading = ctx.projectsPageService.loaderService.loadProjects({
        silent: true,
    });
    await ctx.projectsPageService.onDeleteProject('a', () => undefined);
    older.resolve(ok({ projects: [...LIST].reverse() }));
    await loading;

    expect(ctx.listed('a')).toBeUndefined();
});

test('a-list-requested-before-the-session-expired-does-not-hide-it', async () => {
    const ctx = setup();
    const older = deferred<RequestResult<object>>();
    ctx.rpi.getAllProjectsRequest = jest.fn().mockReturnValue(older.promise);
    ctx.rpi.setProjectTagsRequest = jest.fn().mockResolvedValue(fail(401));

    const loading = ctx.projectsPageService.loaderService.loadProjects({
        silent: true,
    });
    await ctx.projectsPageService.onProjectTagsChange('c', [THESIS]);
    older.resolve(ok({ projects: [...LIST].reverse() }));
    await loading;

    expect(
        ctx.repository.ideViewModelRepository.getProjectsRequestState()
    ).toBe('unauth');
    expect(ctx.repository.projectsViewModelRepository.projects()).toEqual([]);
});

test('a-project-from-the-list-can-be-renamed-while-the-agent-edits-another', async () => {
    const ctx = setup();
    ctx.repository.chatViewModelRepository.setRequestState('running');
    ctx.repository.projectViewModelRepository.setProject({
        ...LIST[0],
        program: { segments: [] },
    } as never);
    ctx.rpi.setTitleRequest = jest.fn().mockResolvedValue(ok({}));
    ctx.rpi.getAllProjectsRequest = jest
        .fn()
        .mockResolvedValue(ok({ projects: [...LIST].reverse() }));
    const failed = jest.fn();

    await ctx.projectPageService.onProjectTitleChanged(
        'b',
        'Другое',
        () => undefined,
        () => undefined
    );
    expect(ctx.rpi.setTitleRequest).toHaveBeenCalledWith('b', 'Другое');

    // открытый проект агент правит: его переименование отклоняется с откатом
    await ctx.projectPageService.onProjectTitleChanged(
        'a',
        'Третье',
        () => undefined,
        failed
    );
    expect(ctx.rpi.setTitleRequest).toHaveBeenCalledTimes(1);
    expect(failed).toHaveBeenCalled();
});

test('no-tags-error-for-a-project-deleted-while-its-tags-were-saving', async () => {
    const ctx = setup();
    const save = deferred<RequestResult<object>>();
    ctx.rpi.setProjectTagsRequest = jest.fn().mockReturnValue(save.promise);
    ctx.rpi.deleteProjectRequest = jest.fn().mockResolvedValue(ok({}));
    ctx.rpi.getAllProjectsRequest = jest.fn().mockResolvedValue(
        ok({
            projects: [...LIST.filter((p) => p.projectId !== 'c')].reverse(),
        })
    );

    const saving = ctx.projectsPageService.onProjectTagsChange('c', [THESIS]);
    await ctx.projectsPageService.onDeleteProject('c', () => undefined);
    save.resolve(fail(404));
    await saving;

    expect(ctx.toasts().some((t) => t.type === 'error')).toBe(false);
    expect(ctx.listed('c')).toBeUndefined();
});

test('a-tags-modal-change-applies-only-what-was-changed-in-it', () => {
    const NEW = { name: 'Новая', color: '#000000' };
    const change = tagsChange([PHYSICS], [PHYSICS, NEW]);
    // сервер хранит то же, что видело окно: уходит ровно результат окна
    expect(change([PHYSICS])).toEqual([PHYSICS, NEW]);
    // сервер хранит другое: добавляется только новая метка
    expect(change([THESIS])).toEqual([THESIS, NEW]);
    // снятая в окне метка снимается, остальное хранимое остаётся
    expect(tagsChange([PHYSICS, THESIS], [THESIS])([PHYSICS, NEW])).toEqual([
        NEW,
    ]);
});

test('a-failed-sidebar-rename-does-not-ride-along-with-a-modal-edit', async () => {
    const ctx = setup();
    const renames = [
        deferred<RequestResult<object>>(),
        deferred<RequestResult<object>>(),
    ];
    const sent: string[] = [];
    ctx.rpi.setProjectTagsRequest = jest
        .fn()
        .mockImplementation(async (id: string, tags: { name: string }[]) => {
            sent.push(`${id}:${tags.map((tag) => tag.name).join(',')}`);
            return sent.length <= 2
                ? renames[sent.length - 1].promise
                : ok({ tags });
        });

    const renamed = ctx.projectsPageService.onTagSave({
        previousName: 'Физика',
        name: 'Физ',
        color: PHYSICS.color,
        projectIds: ['a', 'b'],
    });
    // окно меток открыли уже с новым именем и добавили метку
    const edited = ctx.projectsPageService.onProjectTagsChange('a', [
        ...ctx.listed('a').tags!,
        { name: 'Новая', color: '#000000' },
    ]);
    renames.forEach((rename) => rename.resolve(fail(500)));
    await Promise.all([renamed, edited]);

    expect(sent).toContain('a:Физика,Новая');
    expect(tagNames(ctx, 'a')).toEqual(['Физика:#4469e0', 'Новая:#000000']);
    expect(tagNames(ctx, 'b')).toEqual(['Физика:#4469e0', 'Диплом:#1ca852']);
});

test('a-sidebar-tag-delete-reaches-a-project-whose-modal-edit-failed', async () => {
    const ctx = setup();
    const first = deferred<RequestResult<object>>();
    const sent: string[] = [];
    ctx.rpi.setProjectTagsRequest = jest
        .fn()
        .mockImplementation(async (id: string, tags: { name: string }[]) => {
            sent.push(`${id}:${tags.map((tag) => tag.name).join(',')}`);
            return sent.length === 1 ? first.promise : ok({ tags });
        });

    // в окне сняли «Физику» с a, и пока это сохраняется, метку удалили совсем
    const edited = ctx.projectsPageService.onProjectTagsChange('a', []);
    const deleted = ctx.projectsPageService.onTagDelete('Физика');
    first.resolve(fail(500));
    await Promise.all([edited, deleted]);

    expect(sent).toEqual(['a:', 'b:Диплом', 'a:']);
    expect(tagNames(ctx, 'a')).toEqual([]);
    // отказ перекрыла следующая правка: жаловаться не на что
    expect(ctx.toasts().some((toast) => toast.type === 'error')).toBe(false);
});

test('toggling-access-back-before-the-answer-sends-nothing-extra', async () => {
    const ctx = setup();
    const onEvent = jest.spyOn(ctx.observerService, 'onEvent');
    const first = deferred<RequestResult<object>>();
    ctx.rpi.setProjectVisibilityRequest = jest
        .fn()
        .mockReturnValue(first.promise);

    const on = ctx.projectsPageService.onListedProjectVisibilityChange(
        'a',
        true
    );
    const off = ctx.projectsPageService.onListedProjectVisibilityChange(
        'a',
        false
    );
    first.resolve(fail(500));
    await Promise.all([on, off]);

    expect(ctx.rpi.setProjectVisibilityRequest).toHaveBeenCalledTimes(1);
    expect(ctx.listed('a').isPublic).toBe(false);
    expect(onEvent).not.toHaveBeenCalledWith(
        Events.EVENT_PROJECT_VISIBILITY_CHANGED,
        expect.anything()
    );
    expect(ctx.toasts().some((toast) => toast.type === 'error')).toBe(false);
});

test('an-expired-session-is-reported-once-for-many-refused-edits', async () => {
    const ctx = setup();
    ctx.rpi.setProjectTagsRequest = jest.fn().mockResolvedValue(fail(401));
    ctx.rpi.setProjectVisibilityRequest = jest
        .fn()
        .mockResolvedValue(fail(401));

    await Promise.all([
        ctx.projectsPageService.onProjectTagsChange('c', [THESIS]),
        ctx.projectsPageService.onListedProjectVisibilityChange('a', true),
    ]);

    const expired = ctx.repository.dictionary.filemanager.errors.sessionExpired;
    expect(
        ctx.toasts().filter((toast) => toast.message === expired)
    ).toHaveLength(1);
});

test('no-tag-limit-toast-after-the-session-expired', async () => {
    const ctx = setup();
    const full = Array.from({ length: 10 }, (_, i) => ({
        name: `t${i}`,
        color: '#000000',
    }));
    ctx.repository.projectsViewModelRepository.setProjects([
        project('a', { tags: full }),
        project('b'),
    ]);
    ctx.rpi.setProjectTagsRequest = jest.fn().mockResolvedValue(fail(401));

    await ctx.projectsPageService.onTagSave({
        name: 'Новая',
        color: '#000000',
        projectIds: ['a', 'b'],
    });

    const limit = ctx.repository.dictionary.projects.tags_modal.limit.replace(
        '${max}',
        '10'
    );
    expect(ctx.toasts().some((toast) => toast.message === limit)).toBe(false);
});

test('an-older-list-does-not-undo-a-rename-from-the-list', async () => {
    const ctx = setup();
    const older = deferred<RequestResult<object>>();
    ctx.rpi.getAllProjectsRequest = jest
        .fn()
        .mockReturnValueOnce(older.promise)
        .mockResolvedValue(fail(500));
    ctx.rpi.setTitleRequest = jest.fn().mockResolvedValue(ok({}));

    const loading = ctx.projectsPageService.loaderService.loadProjects({
        silent: true,
    });
    await ctx.projectPageService.onProjectTitleChanged(
        'a',
        'Новое',
        () => undefined,
        () => undefined
    );
    older.resolve(ok({ projects: [...LIST].reverse() }));
    await loading;

    expect(ctx.listed('a').title).toBe('Новое');
});

test('renames-of-one-project-reach-the-server-in-order', async () => {
    const ctx = setup();
    const first = deferred<RequestResult<object>>();
    const sent: string[] = [];
    ctx.rpi.setTitleRequest = jest
        .fn()
        .mockImplementation(async (_id: string, title: string) => {
            sent.push(title);
            return sent.length === 1 ? first.promise : ok({});
        });
    ctx.rpi.getAllProjectsRequest = jest
        .fn()
        .mockResolvedValue(ok({ projects: [...LIST].reverse() }));

    const one = ctx.projectPageService.onProjectTitleChanged(
        'a',
        'Один',
        () => undefined,
        () => undefined
    );
    const two = ctx.projectPageService.onProjectTitleChanged(
        'a',
        'Два',
        () => undefined,
        () => undefined
    );
    await Promise.resolve();
    expect(sent).toEqual(['Один']);
    first.resolve(ok({}));
    await Promise.all([one, two]);

    expect(sent).toEqual(['Один', 'Два']);
});

test('a-dropped-initial-load-does-not-leave-the-spinner-on', async () => {
    const ctx = setup();
    const initial = deferred<RequestResult<object>>();
    ctx.rpi.getAllProjectsRequest = jest.fn().mockReturnValue(initial.promise);
    const loader = ctx.projectsPageService.loaderService;

    const loading = loader.loadProjects();
    loader.discardEarlierLists();
    initial.resolve(ok({ projects: [...LIST].reverse() }));
    await loading;

    expect(
        ctx.repository.ideViewModelRepository.getProjectsRequestState()
    ).toBe('ok');
});

test('a-second-download-click-does-not-start-another-export', async () => {
    const ctx = setup();
    const answer = deferred<RequestResult<object>>();
    ctx.rpi.exportProjectRequest = jest.fn().mockReturnValue(answer.promise);

    const first = ctx.projectsPageService.onDownloadProject('a');
    await ctx.projectsPageService.onDownloadProject('a');
    answer.resolve(fail(500));
    await first;

    expect(ctx.rpi.exportProjectRequest).toHaveBeenCalledTimes(1);
});

test('after-a-reset-the-projects-page-says-the-session-is-over', () => {
    const ctx = setup();
    ctx.repository.ideViewModelRepository.setGetProjectsRequestState('ok');

    ctx.projectsPageService.ideService.resetEditor();

    expect(
        ctx.repository.ideViewModelRepository.getProjectsRequestState()
    ).toBe('unauth');
});

test('a-401-on-the-list-refresh-after-a-copy-reports-the-session', async () => {
    const ctx = setup();
    ctx.rpi.cloneProjectRequest = jest
        .fn()
        .mockResolvedValue(ok({ projectId: 'copy' }));
    ctx.rpi.getAllProjectsRequest = jest.fn().mockResolvedValue(fail(401));

    await ctx.projectsPageService.onDuplicateProject('a');

    const expired = ctx.repository.dictionary.filemanager.errors.sessionExpired;
    expect(ctx.toasts().some((toast) => toast.message === expired)).toBe(true);
    // сброс очистил список: страница говорит, что сессия истекла
    expect(ctx.repository.projectsViewModelRepository.projects()).toEqual([]);
    expect(
        ctx.repository.ideViewModelRepository.getProjectsRequestState()
    ).toBe('unauth');
});

test('a-tag-edit-after-a-401-list-refresh-reports-the-session', async () => {
    const ctx = setup();
    ctx.rpi.getAllProjectsRequest = jest.fn().mockResolvedValue(fail(401));
    ctx.rpi.setProjectTagsRequest = jest.fn().mockResolvedValue(fail(401));

    await ctx.projectsPageService.loaderService.loadProjects({ silent: true });
    await ctx.projectsPageService.onProjectTagsChange('c', [THESIS]);

    const expired = ctx.repository.dictionary.filemanager.errors.sessionExpired;
    expect(
        ctx.toasts().filter((toast) => toast.message === expired)
    ).toHaveLength(1);
});

test('a-refused-tag-is-reported-when-the-next-edit-does-not-include-it', async () => {
    const ctx = setup();
    const first = deferred<RequestResult<object>>();
    const sent: string[] = [];
    ctx.rpi.setProjectTagsRequest = jest
        .fn()
        .mockImplementation(async (_id: string, tags: { name: string }[]) => {
            sent.push(tags.map((tag) => tag.name).join(','));
            return sent.length === 1 ? first.promise : ok({ tags });
        });
    const X = { name: 'X', color: '#000000' };
    const Y = { name: 'Y', color: '#000000' };

    const one = ctx.projectsPageService.onProjectTagsChange('c', [X]);
    // окно открыли снова, уже с X, и добавили Y
    const two = ctx.projectsPageService.onProjectTagsChange('c', [X, Y]);
    first.resolve(fail(500));
    await Promise.all([one, two]);

    expect(sent).toEqual(['X', 'Y']);
    expect(lastToast(ctx)?.message).toBe(
        ctx.repository.dictionary.projects.errors.tags_failed
    );
});

// окно меток открыли, пока отказанная правка ещё висела в списке
test('a-refusal-that-came-while-the-window-was-open-is-not-sent-again', async () => {
    const ctx = setup();
    const sent: string[] = [];
    ctx.rpi.setProjectTagsRequest = jest
        .fn()
        .mockImplementation(async (_id: string, tags: { name: string }[]) => {
            sent.push(tags.map((tag) => tag.name).join(','));
            return sent.length === 1 ? fail(500) : ok({ tags });
        });
    const X = { name: 'X', color: '#000000' };
    const Y = { name: 'Y', color: '#000000' };

    await ctx.projectsPageService.onProjectTagsChange('c', [X]);
    // окно открыли с X, сервер X отказал, в окне добавили Y
    await ctx.projectsPageService.onProjectTagsChange('c', [X, Y], [X]);

    expect(sent).toEqual(['X', 'Y']);
});

test('saving-an-unchanged-window-after-a-refusal-sends-nothing', async () => {
    const ctx = setup();
    const sent: string[] = [];
    ctx.rpi.setProjectTagsRequest = jest
        .fn()
        .mockImplementation(async (_id: string, tags: { name: string }[]) => {
            sent.push(tags.map((tag) => tag.name).join(','));
            return fail(500);
        });
    const X = { name: 'X', color: '#000000' };

    await ctx.projectsPageService.onProjectTagsChange('c', [X]);
    await ctx.projectsPageService.onProjectTagsChange('c', [X], [X]);

    expect(sent).toEqual(['X']);
});

test('tags-differing-only-in-case-are-edited-separately', () => {
    const upper = { name: 'ML', color: '#000000' };
    const lower = { name: 'ml', color: '#000000' };
    const Z = { name: 'Z', color: '#000000' };
    expect(tagsChange([upper, lower], [upper])([upper, lower, Z])).toEqual([
        upper,
        Z,
    ]);
    expect(tagsChange([upper, lower], [lower])([upper, lower, Z])).toEqual([
        lower,
        Z,
    ]);
});

test('a-rename-and-a-tag-edit-refused-together-report-the-session-once', async () => {
    const ctx = setup();
    ctx.rpi.setTitleRequest = jest.fn().mockResolvedValue(fail(401));
    ctx.rpi.setProjectTagsRequest = jest.fn().mockResolvedValue(fail(401));

    await Promise.all([
        ctx.projectsPageService.onProjectTagsChange('c', [THESIS]),
        ctx.projectPageService.onProjectTitleChanged(
            'a',
            'Другое',
            () => undefined,
            () => undefined
        ),
    ]);

    const expired = ctx.repository.dictionary.filemanager.errors.sessionExpired;
    expect(
        ctx.toasts().filter((toast) => toast.message === expired)
    ).toHaveLength(1);
});

test('two-refused-tag-edits-in-a-row-give-one-message', async () => {
    const ctx = setup();
    ctx.rpi.setProjectTagsRequest = jest.fn().mockResolvedValue(fail(500));
    const X = { name: 'X', color: '#000000' };
    const Y = { name: 'Y', color: '#000000' };

    await Promise.all([
        ctx.projectsPageService.onProjectTagsChange('c', [X]),
        ctx.projectsPageService.onProjectTagsChange('c', [X, Y]),
    ]);

    const failed = ctx.repository.dictionary.projects.errors.tags_failed;
    expect(
        ctx.toasts().filter((toast) => toast.message === failed)
    ).toHaveLength(1);
    expect(tagNames(ctx, 'c')).toEqual([]);
});

test('a-refused-tag-added-again-by-hand-gives-no-message', async () => {
    const ctx = setup();
    const first = deferred<RequestResult<object>>();
    const second = deferred<RequestResult<object>>();
    let calls = 0;
    ctx.rpi.setProjectTagsRequest = jest
        .fn()
        .mockImplementation(async (_id: string, tags: object[]) => {
            calls++;
            if (calls === 1) return first.promise;
            if (calls === 2) return second.promise;
            return ok({ tags });
        });
    const X = { name: 'X', color: '#000000' };
    const Y = { name: 'Y', color: '#000000' };

    const a = ctx.projectsPageService.onProjectTagsChange('c', [X]);
    const c = ctx.projectsPageService.onProjectTagsChange('c', [X, Y]);
    first.resolve(fail(500));
    await a;
    // X не сохранился, Y ещё сохраняется: человек добавляет X заново
    expect(tagNames(ctx, 'c')).toEqual(['Y:#000000']);
    const b = ctx.projectsPageService.onProjectTagsChange('c', [Y, X]);
    second.resolve(ok({ tags: [Y] }));
    await Promise.all([c, b]);

    expect(tagNames(ctx, 'c')).toEqual(['Y:#000000', 'X:#000000']);
    expect(ctx.toasts().some((toast) => toast.type === 'error')).toBe(false);
});

test('a-401-after-deleting-the-only-project-reports-the-session', async () => {
    const ctx = setup();
    ctx.repository.projectsViewModelRepository.setProjects([project('a')]);
    ctx.rpi.deleteProjectRequest = jest.fn().mockResolvedValue(ok({}));
    ctx.rpi.getAllProjectsRequest = jest.fn().mockResolvedValue(fail(401));

    await ctx.projectsPageService.onDeleteProject('a', () => undefined);

    const expired = ctx.repository.dictionary.filemanager.errors.sessionExpired;
    expect(
        ctx.toasts().filter((toast) => toast.message === expired)
    ).toHaveLength(1);
});

test('a-second-session-expiry-after-logging-in-again-is-reported', async () => {
    const ctx = setup();
    const expired = ctx.repository.dictionary.filemanager.errors.sessionExpired;
    const expiredToasts = () =>
        ctx.toasts().filter((toast) => toast.message === expired);
    ctx.rpi.setProjectTagsRequest = jest.fn().mockResolvedValue(fail(401));
    await ctx.projectsPageService.onProjectTagsChange('c', [THESIS]);
    expect(expiredToasts()).toHaveLength(1);

    // вошли снова без перезагрузки: список загрузился
    ctx.rpi.getAllProjectsRequest = jest
        .fn()
        .mockResolvedValueOnce(ok({ projects: [...LIST].reverse() }))
        .mockResolvedValue(fail(401));
    await ctx.projectsPageService.loaderService.loadProjects();
    // сессия истекла снова: копия создалась, а список уже не отдают
    ctx.rpi.cloneProjectRequest = jest
        .fn()
        .mockResolvedValue(ok({ projectId: 'copy' }));
    await ctx.projectsPageService.onDuplicateProject('a');

    expect(expiredToasts()).toHaveLength(2);
    expect(ctx.repository.projectsViewModelRepository.projects()).toEqual([]);
});

test('a-refused-edit-followed-by-a-401-speaks-only-of-the-session', async () => {
    const ctx = setup();
    ctx.rpi.setProjectTagsRequest = jest
        .fn()
        .mockResolvedValueOnce(fail(500))
        .mockResolvedValue(fail(401));
    const X = { name: 'X', color: '#000000' };
    const Y = { name: 'Y', color: '#000000' };

    await Promise.all([
        ctx.projectsPageService.onProjectTagsChange('c', [X]),
        ctx.projectsPageService.onProjectTagsChange('c', [X, Y]),
    ]);

    expect(ctx.toasts().map((toast) => toast.message)).toEqual([
        ctx.repository.dictionary.filemanager.errors.sessionExpired,
    ]);
});
