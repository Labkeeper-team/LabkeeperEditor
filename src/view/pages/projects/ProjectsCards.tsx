import { useSelector } from 'react-redux';

import { ActionMenu } from '../../components/actionMenu';
import { useDictionary } from '../../store/selectors/translations';
import {
    ListedProjectTitle,
    ProjectAccessBadge,
    ProjectListProps,
    ProjectRowTags,
    ProjectTypeBadge,
} from './projectCells.tsx';
import { useProjectTimes } from './projectLinks.ts';

/** Список проектов на телефоне: карточка вместо строки таблицы */
export const ProjectsCards = (props: ProjectListProps) => {
    const texts = useSelector(useDictionary).projects;
    const times = useProjectTimes();
    return (
        <div className="projects-card-list">
            {props.projects.map((p) => (
                <div
                    key={p.projectId}
                    className="projects-card"
                    onClick={(e) => props.onProjectClick(e, p.projectId)}
                    onAuxClick={(e) => props.onProjectClick(e, p.projectId)}
                >
                    <div className="projects-card__main">
                        <ListedProjectTitle
                            project={p}
                            renamingId={props.renamingId}
                            onRenamingChange={props.onRenamingChange}
                        />
                        <div className="projects-card__meta">
                            <ProjectTypeBadge project={p} />
                            <ProjectAccessBadge project={p} />
                            <span title={times.full(p.lastModified)}>
                                {times.relative(p.lastModified)}
                            </span>
                        </div>
                        <ProjectRowTags
                            project={p}
                            activeTag={props.activeTag}
                            onToggleTag={props.onToggleTag}
                        />
                    </div>
                    <ActionMenu
                        label={texts.actions.menu}
                        actions={props.actionsFor(p)}
                    />
                </div>
            ))}
        </div>
    );
};
