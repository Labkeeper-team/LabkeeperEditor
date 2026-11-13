import { RefObject, useMemo } from 'react';
import { useSelector } from 'react-redux';
import classNames from 'classnames';

import { SearchIcon } from '../../icons';
import { Select } from '../../components/select';
import { SegmentedControl } from '../../components/segmentedControl';
import { useDictionary } from '../../store/selectors/translations';
import {
    AccessFilter,
    ProjectsSort,
    SortField,
    TypeFilter,
} from '../../../viewModel/domain/projectsFilter.ts';
import { PROJECT_TYPE_LABELS } from './projectLinks.ts';
import { ProjectsFilterState, shownText } from './useProjectsFilter.ts';

/**
 * Поиск, переключатели типа и доступа, сортировка списком и сводка фильтра.
 * На компьютере доступ выбирается в боковой панели, а список сортировки
 * виден, только пока нет колонки «Создан» (это решает CSS)
 */
export const ProjectsToolbar = ({
    state,
    total,
    isMobile,
    searchRef,
}: {
    state: ProjectsFilterState;
    total: number;
    isMobile: boolean;
    searchRef: RefObject<HTMLInputElement | null>;
}) => {
    const texts = useSelector(useDictionary).projects;
    const { filter, sort } = state;

    const sortOptions = useMemo(
        () => [
            { value: 'modified-desc', label: `${texts.last_modified} ↓` },
            { value: 'modified-asc', label: `${texts.last_modified} ↑` },
            { value: 'created-desc', label: `${texts.created} ↓` },
            { value: 'created-asc', label: `${texts.created} ↑` },
            { value: 'title-asc', label: `${texts.title}, ${texts.sort_az}` },
            { value: 'title-desc', label: `${texts.title}, ${texts.sort_za}` },
        ],
        [
            texts.last_modified,
            texts.created,
            texts.title,
            texts.sort_az,
            texts.sort_za,
        ]
    );

    return (
        <div className="projects-toolbar">
            <label className="projects-search">
                <SearchIcon />
                <input
                    ref={searchRef}
                    type="search"
                    value={filter.search}
                    placeholder={texts.search_placeholder}
                    aria-label={texts.search_placeholder}
                    onChange={(e) => state.setSearch(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape' && filter.search) {
                            e.stopPropagation();
                            state.setSearch('');
                        }
                    }}
                />
                {!filter.search && !isMobile ? (
                    <kbd className="projects-search__hint">/</kbd>
                ) : null}
            </label>
            {state.showTypeFilter ? (
                <SegmentedControl<TypeFilter>
                    ariaLabel={texts.type}
                    value={filter.type}
                    options={[
                        { value: 'all', label: texts.all },
                        { value: 'latex', label: PROJECT_TYPE_LABELS.latex },
                        {
                            value: 'markdown',
                            label: PROJECT_TYPE_LABELS.markdown,
                        },
                    ]}
                    onChange={state.selectType}
                />
            ) : null}
            {/* на телефоне по ТЗ, даже если публичных проектов нет */}
            {isMobile ? (
                <SegmentedControl<AccessFilter>
                    ariaLabel={texts.access}
                    value={filter.access}
                    options={[
                        { value: 'all', label: texts.all },
                        { value: 'public', label: texts.public },
                        { value: 'private', label: texts.private },
                    ]}
                    onChange={state.selectAccess}
                />
            ) : null}
            {total ? (
                <div
                    className={classNames('projects-mobile-sort', {
                        'projects-mobile-sort--desktop': !isMobile,
                    })}
                >
                    <Select
                        options={sortOptions}
                        value={`${sort.field}-${sort.direction}`}
                        onChange={(value: unknown) => {
                            const [field, direction] = String(value).split(
                                '-'
                            ) as [SortField, ProjectsSort['direction']];
                            state.updateSort({ field, direction });
                        }}
                    />
                </div>
            ) : null}
            {/* ТЗ: «2 из 6 · Сбросить фильтры». Стоит в строке инструментов, а не
                отдельной строкой: строка от фильтра не растёт, и список не сдвигается */}
            {!isMobile && state.filterActive && total ? (
                <div className="projects-summary" role="status">
                    <span>{shownText(texts.shown, state, total)}</span>
                    <span aria-hidden>·</span>
                    <button
                        type="button"
                        className="projects-link-button"
                        onClick={() => state.resetFilters('summary')}
                    >
                        {texts.reset_filters}
                    </button>
                </div>
            ) : null}
        </div>
    );
};
