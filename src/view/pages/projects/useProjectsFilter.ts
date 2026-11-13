import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { ProjectShort } from '../../../model/domain';
import { Events } from '../../../model/service/ObserverService.ts';
import {
    AccessFilter,
    DEFAULT_SORT,
    EMPTY_FILTER,
    ProjectsFilter,
    ProjectsSort,
    SortField,
    TypeFilter,
    collectTags,
    defaultDirection,
    isFilterActive,
    isSort,
    matchesFilter,
    sortProjects,
    tagKey,
} from '../../../viewModel/domain/projectsFilter.ts';
import { controller } from '../../../main.tsx';
import { AppDispatch, StorageState } from '../../store';
import { useCurrentLanguage } from '../../store/selectors/translations';
import { setProjectsSort } from '../../store/slices/persistence';

/** Что известно о выбранной метке, см. ниже */
interface TagMemory {
    tag: string | null;
    /** Прежнее имя переименованной метки, пока сервер не ответил */
    fallback: string | null;
    /** Метку уже видели в списке */
    seen: boolean;
}

const NO_TAG_MEMORY: TagMemory = { tag: null, fallback: null, seen: false };

/** Откуда сбросили фильтры: аналитика различает кнопки */
export type ResetPlace = 'header' | 'summary' | 'no_matches';

/**
 * Поиск, фильтры и сортировка страницы проектов. Фильтр живёт на странице,
 * сортировка в общем хранилище и переживает перезагрузку. Каждое действие
 * человека с фильтром уходит в аналитику
 */
export const useProjectsFilter = (projects: ProjectShort[]) => {
    const dispatch = useDispatch<AppDispatch>();
    const lang = useSelector(useCurrentLanguage);
    const savedSort = useSelector(
        (state: StorageState) => state.persistence.projectsSort
    );
    const sort = isSort(savedSort) ? savedSort : DEFAULT_SORT;
    const [rawFilter, setFilter] = useState<ProjectsFilter>(EMPTY_FILTER);

    // китайские названия упорядочиваем по пиньиню, для остальных порядок прежний
    const collator = useMemo(
        () =>
            new Intl.Collator(lang === 'zh' ? ['zh-CN', 'en'] : ['en', 'ru'], {
                sensitivity: 'base',
                numeric: true,
            }),
        [lang]
    );

    const knownTags = useMemo(
        () => collectTags(projects, collator),
        [projects, collator]
    );

    // метку сняли со всех проектов: фильтровать по ней больше нельзя
    const knownKeys = useMemo(
        () => new Set(knownTags.map((tag) => tagKey(tag.name))),
        [knownTags]
    );

    /*
     * Выбранная метка может пропасть: её сняли со всех проектов или её
     * переименование не удалось. Метку, которую уже видели в списке, тогда
     * снимаем совсем, а не прячем: иначе выбор сам включился бы, когда метка
     * с тем же именем появится снова. После неудачного переименования выбор
     * возвращается к прежнему имени
     */
    const [tagMemory, setTagMemory] = useState<TagMemory>(NO_TAG_MEMORY);
    const memory =
        tagMemory.tag === rawFilter.tag
            ? tagMemory
            : { tag: rawFilter.tag, fallback: null, seen: false };
    const tagKnown = rawFilter.tag !== null && knownKeys.has(rawFilter.tag);
    const fallbackKnown =
        memory.fallback !== null && knownKeys.has(memory.fallback);
    if (tagKnown && (!memory.seen || memory !== tagMemory)) {
        setTagMemory({ ...memory, seen: true });
    } else if (rawFilter.tag !== null && !tagKnown && memory.seen) {
        const next = fallbackKnown ? memory.fallback : null;
        setFilter((current) => ({ ...current, tag: next }));
        setTagMemory({ tag: next, fallback: null, seen: next !== null });
    }
    const selectedTag = tagKnown
        ? rawFilter.tag
        : fallbackKnown
          ? memory.fallback
          : null;
    const filter = useMemo<ProjectsFilter>(
        () =>
            selectedTag === rawFilter.tag
                ? rawFilter
                : { ...rawFilter, tag: selectedTag },
        [rawFilter, selectedTag]
    );

    const visibleProjects = useMemo(
        () =>
            sortProjects(
                projects.filter((project) => matchesFilter(project, filter)),
                sort,
                collator
            ),
        [projects, filter, sort, collator]
    );

    const typesPresent = useMemo(
        () =>
            new Set(
                projects.map((project) => project.projectType).filter(Boolean)
            ),
        [projects]
    );

    const trackFilter = useCallback(
        (kind: string, value: unknown) =>
            controller.trackUiEvent(Events.EVENT_PROJECTS_FILTERED, {
                kind,
                value,
                projects_count: projects.length,
            }),
        [projects.length]
    );

    const updateSort = useCallback(
        (next: ProjectsSort) => {
            dispatch(setProjectsSort(next));
            trackFilter('sort', `${next.field}-${next.direction}`);
        },
        [dispatch, trackFilter]
    );

    const onSortColumn = useCallback(
        (field: SortField) => {
            updateSort(
                sort.field === field
                    ? {
                          field,
                          direction: sort.direction === 'asc' ? 'desc' : 'asc',
                      }
                    : { field, direction: defaultDirection(field) }
            );
        },
        [sort, updateSort]
    );

    /** Метка выбирается одна, как в Overleaf; null снимает выбор */
    const selectTag = useCallback(
        (key: string | null) => {
            setFilter((current) => ({ ...current, tag: key, untagged: false }));
            trackFilter('tag', key === null ? 'all' : 'tag');
        },
        [trackFilter]
    );

    /** Метка в строке или на телефоне: щелчок по выбранной снимает выбор */
    const toggleTag = useCallback(
        (name: string) => {
            const key = tagKey(name);
            selectTag(filter.tag === key ? null : key);
        },
        [selectTag, filter.tag]
    );

    const selectUntagged = useCallback(() => {
        setFilter((current) => ({
            ...current,
            tag: null,
            untagged: !current.untagged,
        }));
        trackFilter('tag', filter.untagged ? 'all' : 'untagged');
    }, [trackFilter, filter.untagged]);

    /** «Все проекты» в боковой панели: доступ и метка сразу, одним событием */
    const selectAll = useCallback(() => {
        setFilter((current) => ({
            ...current,
            access: 'all',
            tag: null,
            untagged: false,
        }));
        trackFilter('access', 'all');
    }, [trackFilter]);

    const selectAccess = useCallback(
        (access: AccessFilter) => {
            setFilter((current) => ({ ...current, access }));
            trackFilter('access', access);
        },
        [trackFilter]
    );

    const selectType = useCallback(
        (type: TypeFilter) => {
            setFilter((current) => ({ ...current, type }));
            trackFilter('type', type);
        },
        [trackFilter]
    );

    const setSearch = useCallback((search: string) => {
        setFilter((current) => ({ ...current, search }));
    }, []);

    const resetFilters = useCallback(
        (place: ResetPlace) => {
            setFilter(EMPTY_FILTER);
            trackFilter('reset', place);
        },
        [trackFilter]
    );

    /** Выбранная метка идёт за переименованием, а не сбрасывается */
    const onTagSaved = useCallback(
        (previousName: string | undefined, name: string) => {
            if (
                previousName === undefined ||
                rawFilter.tag !== tagKey(previousName)
            ) {
                return;
            }
            // прежнее имя запоминаем: если сервер откажет, выбор вернётся к нему
            setFilter((current) => ({ ...current, tag: tagKey(name) }));
            setTagMemory({
                tag: tagKey(name),
                fallback: tagKey(previousName),
                seen: false,
            });
        },
        [rawFilter.tag]
    );

    /** Удалённая метка перестаёт быть выбранной, даже если появится снова */
    const onTagDeleted = useCallback((name: string) => {
        setFilter((current) =>
            current.tag === tagKey(name) ? { ...current, tag: null } : current
        );
    }, []);

    // поиск считаем, когда человек перестал печатать, а не на каждую букву;
    // сам запрос не отправляем
    const searching = filter.search.trim() !== '';
    useEffect(() => {
        if (!searching) {
            return;
        }
        const timer = setTimeout(() => trackFilter('search', null), 1500);
        return () => clearTimeout(timer);
    }, [filter.search, searching, trackFilter]);

    return {
        filter,
        filterActive: isFilterActive(filter),
        visibleProjects,
        knownTags,
        collator,
        /** Переключатель типа нужен, только если есть проекты обоих типов */
        showTypeFilter: typesPresent.size > 1 || filter.type !== 'all',
        sort,
        updateSort,
        onSortColumn,
        setSearch,
        selectTag,
        toggleTag,
        selectUntagged,
        selectAll,
        selectAccess,
        selectType,
        resetFilters,
        onTagSaved,
        onTagDeleted,
    };
};

export type ProjectsFilterState = ReturnType<typeof useProjectsFilter>;

/** «2 из 6» */
export const shownText = (
    template: string,
    state: ProjectsFilterState,
    total: number
) =>
    template
        .replace('${shown}', `${state.visibleProjects.length}`)
        .replace('${total}', `${total}`);
