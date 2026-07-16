import './style.scss';
import { Typography } from '../../../components/typography';
import { colors } from '../../../styles/colors';
import { SortDirection, SortMode } from '../useSortedFilteredProjects';

type SortableHeaderCellProps = {
    label: string;
    mode: SortMode;
    sortMode: SortMode;
    sortDirection: SortDirection;
    onSortChange: (mode: SortMode, direction: SortDirection) => void;
};

export const SortableHeaderCell = ({
    label,
    mode,
    sortMode,
    sortDirection,
    onSortChange,
}: SortableHeaderCellProps) => {
    const isAscActive = sortMode === mode && sortDirection === 'asc';
    const isDescActive = sortMode === mode && sortDirection === 'desc';

    return (
        <div className="projects-header-cell">
            <Typography color={colors.gray30} text={label} />
            <button
                className="projects-sort-icon-button"
                onClick={(e) => {
                    e.stopPropagation();
                    onSortChange(mode, 'asc');
                }}
                type="button"
                aria-label={label}
            >
                <span
                    className={`sort-arrow ${isAscActive ? 'is-active' : ''}`}
                >
                    ▲
                </span>
            </button>
            <button
                className="projects-sort-icon-button"
                onClick={(e) => {
                    e.stopPropagation();
                    onSortChange(mode, 'desc');
                }}
                type="button"
                aria-label={label}
            >
                <span
                    className={`sort-arrow ${isDescActive ? 'is-active' : ''}`}
                >
                    ▼
                </span>
            </button>
        </div>
    );
};
