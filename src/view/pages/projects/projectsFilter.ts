import {
    ProjectShort,
    ProjectTag,
    ProjectType,
} from '../../../model/domain.ts';

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

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export const tagKey = (name: string) => name.trim().toLocaleLowerCase();

/** Цвет новой метки по её имени: у одинаковых имён одинаковый */
export const defaultTagColor = (name: string): string => {
    let hash = 0;
    for (const char of tagKey(name)) {
        hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
    }
    return TAG_COLORS[hash % TAG_COLORS.length];
};

const SHORT_HEX_COLOR = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const NEUTRAL_BORDER = '#bfc8de';
const DARK_TEXT = '#0e1621';

let colorContext: CanvasRenderingContext2D | null | undefined;
const hexCache = new Map<string, string | null>();

/**
 * Любой CSS-цвет с сервера в вид #rrggbb: так от него можно взять
 * полупрозрачный фон и яркость. Не-hex цвета разбирает сам браузер через
 * canvas; что он не понял, считается отсутствующим цветом
 */
export const toHexColor = (color: string): string | null => {
    const value = color.trim();
    if (HEX_COLOR.test(value)) {
        return value.toLowerCase();
    }
    const short = SHORT_HEX_COLOR.exec(value);
    if (short) {
        return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
    }
    if (!value) {
        return null;
    }
    if (hexCache.has(value)) {
        return hexCache.get(value)!;
    }
    if (colorContext === undefined) {
        try {
            colorContext =
                typeof document === 'undefined' ||
                /jsdom/i.test(navigator.userAgent)
                    ? null
                    : document.createElement('canvas').getContext('2d');
        } catch {
            colorContext = null;
        }
    }
    let hex: string | null = null;
    if (colorContext) {
        // два разных начальных цвета: если строка не цвет, fillStyle не меняется
        colorContext.fillStyle = '#010203';
        colorContext.fillStyle = value;
        const first = String(colorContext.fillStyle);
        colorContext.fillStyle = '#030201';
        colorContext.fillStyle = value;
        const second = String(colorContext.fillStyle);
        hex = first === second && HEX_COLOR.test(first) ? first : null;
    }
    hexCache.set(value, hex);
    return hex;
};

/** Относительная яркость по WCAG: 0 чёрный, 1 белый */
const luminance = (hex: string) => {
    const channel = (offset: number) => {
        const c = parseInt(hex.slice(offset, offset + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
};

/**
 * Цвета метки: точка, светлый фон, рамка и текст выбранной (залитой) метки.
 * У очень светлых цветов рамка нейтральная, иначе метка сливается с белым,
 * а текст на заливке тёмный, иначе его не прочесть
 */
export const tagColors = (color: string) => {
    const hex = toHexColor(color) ?? TAG_COLORS[7];
    const light = luminance(hex) > 0.7;
    return {
        dot: hex,
        background: `${hex}1f`,
        border: light ? NEUTRAL_BORDER : `${hex}55`,
        activeBorder: light ? NEUTRAL_BORDER : hex,
        activeText: luminance(hex) > 0.45 ? DARK_TEXT : '#ffffff',
    };
};

/** Все метки человека: самые частые первыми, при равенстве по алфавиту */
export const collectTags = (
    projects: ProjectShort[],
    collator: Intl.Collator
): KnownTag[] => {
    const tags = new Map<string, KnownTag>();
    for (const project of projects) {
        for (const tag of project.tags ?? []) {
            const key = tagKey(tag.name);
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

const SORT_STORAGE_KEY = 'labkeeper.projects.sort';

const isSort = (value: unknown): value is ProjectsSort => {
    const sort = value as ProjectsSort;
    return (
        !!sort &&
        ['title', 'modified', 'created'].includes(sort.field) &&
        ['asc', 'desc'].includes(sort.direction)
    );
};

/** Сортировка запоминается в браузере; без хранилища страница работает как раньше */
export const loadSort = (): ProjectsSort => {
    try {
        const saved = JSON.parse(
            window.localStorage.getItem(SORT_STORAGE_KEY) ?? 'null'
        );
        return isSort(saved) ? saved : DEFAULT_SORT;
    } catch {
        return DEFAULT_SORT;
    }
};

export const saveSort = (sort: ProjectsSort) => {
    try {
        window.localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(sort));
    } catch {
        // приватный режим или запрет хранилища: сортировка просто не запомнится
    }
};
