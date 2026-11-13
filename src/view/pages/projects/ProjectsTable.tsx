import { useSelector } from 'react-redux';
import classNames from 'classnames';

import { ActionMenu } from '../../components/actionMenu';
import { TruncatedTextTooltip } from '../../components/truncatedTextTooltip';
import { useDictionary } from '../../store/selectors/translations';
import {
    ProjectsSort,
    SortField,
} from '../../../viewModel/domain/projectsFilter.ts';
import {
    ListedProjectTitle,
    ProjectAccessBadge,
    ProjectListProps,
    ProjectRowTags,
    ProjectTypeBadge,
} from './projectCells.tsx';
import { projectHref, useProjectTimes } from './projectLinks.ts';

const PROJECT_TITLE_TOOLTIP_ID = 'projects-title-tooltip';

/**
 * Список проектов на компьютере. Заголовки «Название», «Изменён» и «Создан»
 * сортируют, повторный щелчок меняет направление
 */
export const ProjectsTable = ({
    sort,
    onSortColumn,
    ...props
}: ProjectListProps & {
    sort: ProjectsSort;
    onSortColumn: (field: SortField) => void;
}) => {
    const texts = useSelector(useDictionary).projects;
    const times = useProjectTimes();

    const sortHeader = (field: SortField, label: string) => {
        const active = sort.field === field;
        return (
            <button
                type="button"
                className={classNames('projects-sort-button', {
                    'is-active': active,
                })}
                onClick={(e) => {
                    e.stopPropagation();
                    onSortColumn(field);
                }}
            >
                {label}
                <span className="sort-arrow" aria-hidden>
                    {active ? (sort.direction === 'asc' ? '▲' : '▼') : '▲▼'}
                </span>
            </button>
        );
    };
    const ariaSort = (field: SortField) =>
        sort.field === field
            ? sort.direction === 'asc'
                ? 'ascending'
                : 'descending'
            : undefined;

    return (
        <>
            <table className="projects-table">
                <thead>
                    <tr>
                        <th aria-sort={ariaSort('title')}>
                            {sortHeader('title', texts.title)}
                        </th>
                        <th className="projects-col-type">{texts.type}</th>
                        <th className="projects-col-access">{texts.access}</th>
                        <th
                            className="projects-col-date"
                            aria-sort={ariaSort('modified')}
                        >
                            {sortHeader('modified', texts.last_modified)}
                        </th>
                        <th
                            className="projects-col-date projects-col-created"
                            aria-sort={ariaSort('created')}
                        >
                            {sortHeader('created', texts.created)}
                        </th>
                        <th className="projects-col-actions" />
                    </tr>
                </thead>
                <tbody>
                    {props.projects.map((p) => (
                        <tr
                            key={p.projectId}
                            className={classNames({
                                'is-renaming': props.renamingId === p.projectId,
                            })}
                            onClick={(e) =>
                                props.onProjectClick(e, p.projectId)
                            }
                            onAuxClick={(e) =>
                                props.onProjectClick(e, p.projectId)
                            }
                        >
                            <td className="projects-cell-title">
                                <ListedProjectTitle
                                    project={p}
                                    tooltipId={PROJECT_TITLE_TOOLTIP_ID}
                                    renamingId={props.renamingId}
                                    onRenamingChange={props.onRenamingChange}
                                />
                                <ProjectRowTags
                                    project={p}
                                    activeTag={props.activeTag}
                                    onToggleTag={props.onToggleTag}
                                />
                            </td>
                            <td className="projects-col-type">
                                <ProjectTypeBadge project={p} />
                            </td>
                            <td className="projects-col-access">
                                <ProjectAccessBadge project={p} />
                            </td>
                            <td className="projects-col-date">
                                <a
                                    className="projects-row-link"
                                    href={projectHref(p.projectId)}
                                    title={times.full(p.lastModified)}
                                    // та же ссылка, что у названия: Tab по ней второй раз не ходит
                                    tabIndex={-1}
                                >
                                    {times.relative(p.lastModified)}
                                </a>
                            </td>
                            <td
                                className="projects-col-date projects-col-created"
                                title={times.full(p.creationTime)}
                            >
                                {times.relative(p.creationTime)}
                            </td>
                            <td className="projects-col-actions">
                                <ActionMenu
                                    label={texts.actions.menu}
                                    actions={props.actionsFor(p)}
                                />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <TruncatedTextTooltip
                id={PROJECT_TITLE_TOOLTIP_ID}
                isMobile={false}
            />
        </>
    );
};
