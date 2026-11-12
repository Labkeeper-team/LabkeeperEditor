/**
 * Фильтр, сортировка и метки страницы проектов. Это логика данных, а не
 * вида: её зовут и страница, и ProjectsPageService, и опыты
 */
import { ProjectShort, ProjectTag, ProjectType } from '../../model/domain.ts';

export type SortField = 'title' | 'modified' | 'created';
export type SortDirection = 'asc' | 'desc';
export type TypeFilter = 'all' | ProjectType;
export type AccessFilter = 'all' | 'public' | 'private';

export interface ProjectsSort {
    field: SortField;
    direction: SortDirection;
}

export interface ProjectsFilter {
    search: string;
    /**
     * Выбранная в боковой панели метка (имя в нижнем регистре), как в
     * Overleaf выбирается одна. null значит любые метки
     */
    tag: string | null;
    /** Только проекты без меток */
    untagged: boolean;
    type: TypeFilter;
    access: AccessFilter;
}

export const DEFAULT_SORT: ProjectsSort = {
    field: 'modified',
    direction: 'desc',
};

export const EMPTY_FILTER: ProjectsFilter = {
    search: '',
    tag: null,
    untagged: false,
    type: 'all',
    access: 'all',
};

/** Метка, которая встречается в проектах человека, и сколько раз */
export interface KnownTag extends ProjectTag {
    count: number;
}

/**
 * Цвета меток. Подобраны так, чтобы тёмный текст читался на их светлом
 * фоне, а сами точки различались между собой
 */
/** Имена образцов по порядку TAG_COLORS: по ним подписи для экранного диктора */
export const TAG_COLOR_NAMES = [
    'blue',
    'green',
    'yellow',
    'red',
    'purple',
    'teal',
    'orange',
    'gray',
] as const;

export const TAG_COLORS = [
    '#4469e0',
    '#1ca852',
    '#e0a100',
    '#e5533d',
    '#8e44ad',
    '#0e9aa7',
    '#e67e22',
    '#8c98b0',
] as const;

/** Имя образца палитры или null, если цвет не из неё */
export const tagColorName = (
    color: string
): (typeof TAG_COLOR_NAMES)[number] | null => {
    const index = (TAG_COLORS as readonly string[]).indexOf(
        color.toLowerCase()
    );
    return index < 0 ? null : TAG_COLOR_NAMES[index];
};

export const tagKey = (name: string) => name.trim().toLocaleLowerCase();

/**
 * Метки проекта без точных повторов имени. Сервер их не допускает, но если
 * повтор всё же пришёл, показывать его дважды незачем
 */
export const uniqueTags = (tags: ProjectTag[] = []): ProjectTag[] => {
    const seen = new Set<string>();
    return tags.filter((tag) => {
        if (seen.has(tag.name)) {
            return false;
        }
        seen.add(tag.name);
        return true;
    });
};

/** Цвет новой метки по её имени: у одинаковых имён одинаковый */
export const defaultTagColor = (name: string): string => {
    let hash = 0;
    for (const char of tagKey(name)) {
        hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
    }
    return TAG_COLORS[hash % TAG_COLORS.length];
};

/** Все метки человека: самые частые первыми, при равенстве по алфавиту */
export const collectTags = (
    projects: ProjectShort[],
    collator: Intl.Collator
): KnownTag[] => {
    const tags = new Map<string, KnownTag>();
    for (const project of projects) {
        // «Физика» и «физика» у одного проекта считаются одним проектом
        const counted = new Set<string>();
        for (const tag of project.tags ?? []) {
            const key = tagKey(tag.name);
            if (counted.has(key)) {
                continue;
            }
            counted.add(key);
            const known = tags.get(key);
            if (known) {
                known.count += 1;
            } else {
                tags.set(key, { ...tag, count: 1 });
            }
        }
    }
    return [...tags.values()].sort(
        (a, b) => b.count - a.count || collator.compare(a.name, b.name)
    );
};

const toTimestamp = (value?: string) => {
    if (!value) {
        return 0;
    }
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
};

export const isFilterActive = (filter: ProjectsFilter) =>
    !!filter.search.trim() ||
    filter.tag !== null ||
    filter.untagged ||
    filter.type !== 'all' ||
    filter.access !== 'all';

/**
 * Поиск ищет каждое слово запроса в названии или в метках, без учёта
 * регистра: «лаб физ» найдёт «Лабораторная» с меткой «физика»
 */
export const matchesFilter = (
    project: ProjectShort,
    filter: ProjectsFilter
): boolean => {
    if (filter.type !== 'all' && project.projectType !== filter.type) {
        return false;
    }
    if (
        filter.access !== 'all' &&
        !!project.isPublic !== (filter.access === 'public')
    ) {
        return false;
    }
    const projectTags = (project.tags ?? []).map((tag) => tagKey(tag.name));
    if (filter.tag !== null && !projectTags.includes(filter.tag)) {
        return false;
    }
    if (filter.untagged && projectTags.length) {
        return false;
    }
    const words = filter.search
        .toLocaleLowerCase()
        .split(/\s+/)
        .filter(Boolean);
    if (!words.length) {
        return true;
    }
    const haystack = [project.title.toLocaleLowerCase(), ...projectTags];
    return words.every((word) => haystack.some((text) => text.includes(word)));
};

export const sortProjects = (
    projects: ProjectShort[],
    sort: ProjectsSort,
    collator: Intl.Collator
): ProjectShort[] => {
    const sign = sort.direction === 'asc' ? 1 : -1;
    const compare = (a: ProjectShort, b: ProjectShort): number => {
        switch (sort.field) {
            case 'title':
                return collator.compare(a.title ?? '', b.title ?? '');
            case 'created':
                return (
                    toTimestamp(a.creationTime) - toTimestamp(b.creationTime)
                );
            default:
                return (
                    toTimestamp(a.lastModified) - toTimestamp(b.lastModified)
                );
        }
    };
    return [...projects].sort((a, b) => sign * compare(a, b));
};

/** Направление, с которого колонка начинает: даты с новых, имена с А */
export const defaultDirection = (field: SortField): SortDirection =>
    field === 'title' ? 'asc' : 'desc';

/** Сохранённая сортировка: из хранилища может прийти что угодно, например от старой версии */
export const isSort = (value: unknown): value is ProjectsSort => {
    const sort = value as ProjectsSort;
    return (
        !!sort &&
        ['title', 'modified', 'created'].includes(sort.field) &&
        ['asc', 'desc'].includes(sort.direction)
    );
};
