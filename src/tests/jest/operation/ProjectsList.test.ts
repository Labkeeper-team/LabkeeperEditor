import { ProjectShort } from '../../../model/domain.ts';
import { RequestResult } from '../../../model/rpi';
import { Events } from '../../../model/service/ObserverService.ts';
import { MockViewModelRepository } from '../../../viewModel/repository';
import { normalizeProjectTags } from '../../../viewModel/operation/ProjectsPageService.ts';
import {
    DEFAULT_SORT,
    EMPTY_FILTER,
    collectTags,
    defaultTagColor,
    tagColors,
    isFilterActive,
    matchesFilter,
    sortProjects,
} from '../../../view/pages/projects/projectsFilter.ts';
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

test('a-failed-older-tag-edit-does-not-undo-a-newer-one', async () => {
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

    expect(order).toEqual(['A', 'A,B']);
    expect(tagNames(ctx, 'c')).toEqual(['A:#000000', 'B:#000000']);
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
    expect(tagNames(ctx, 'c')).toEqual(['Новая:#000000']);

    save.resolve(ok({ tags: [{ name: 'Новая', color: '#000000' }] }));
    await saving;
    expect(tagNames(ctx, 'c')).toEqual(['Новая:#000000']);
});

test('download-explains-payment-and-lock-errors', async () => {
    const ctx = setup();
    ctx.rpi.exportProjectRequest = jest
        .fn()
        .mockResolvedValueOnce(fail(402))
        .mockResolvedValueOnce(fail(423));

    await ctx.projectsPageService.onDownloadProject('a');
    expect(lastToast(ctx)?.message).toBe(
        ctx.repository.dictionary.prompt_modal.errors.payment_required
    );
    await ctx.projectsPageService.onDownloadProject('a');
    expect(lastToast(ctx)?.message).toBe(
        ctx.repository.dictionary.synctex.errors.locked
    );
});
