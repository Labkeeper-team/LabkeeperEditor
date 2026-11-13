import React from 'react';
import { useSelector } from 'react-redux';
import classNames from 'classnames';

import { ProjectShort } from '../../../model/domain';
import {
    tagKey,
    uniqueTags,
} from '../../../viewModel/domain/projectsFilter.ts';
import { useDictionary } from '../../store/selectors/translations';
import { TagChip } from './tagChip';
import { PROJECT_TYPE_LABELS, projectHref } from './projectLinks.ts';
import { ProjectTitle } from './projectTitle';
import { MenuAction } from '../../components/actionMenu';

/** Ячейки проекта, общие у таблицы и карточек на телефоне */

export const ProjectTypeBadge = ({ project }: { project: ProjectShort }) =>
    project.projectType ? (
        <span
            className={classNames(
                'projects-badge',
                `projects-badge--${project.projectType}`
            )}
        >
            {PROJECT_TYPE_LABELS[project.projectType] ?? project.projectType}
        </span>
    ) : null;

export const ProjectAccessBadge = ({ project }: { project: ProjectShort }) => {
    const texts = useSelector(useDictionary).projects;
    return (
        <span
            className={classNames('projects-access', {
                'projects-access--public': project.isPublic,
            })}
        >
            <span className="projects-access__dot" />
            {project.isPublic ? texts.public : texts.private}
        </span>
    );
};

/** Метки в строке: щелчок делает то же, что метка в боковой панели */
export const ProjectRowTags = ({
    project,
    activeTag,
    onToggleTag,
}: {
    project: ProjectShort;
    activeTag: string | null;
    onToggleTag: (name: string) => void;
}) =>
    project.tags?.length ? (
        <div className="projects-row-tags">
            {uniqueTags(project.tags).map((tag) => (
                <TagChip
                    // ключ по точному имени: «Физика» и «физика» две метки
                    key={tag.name}
                    tag={tag}
                    small
                    active={activeTag === tagKey(tag.name)}
                    onClick={() => onToggleTag(tag.name)}
                />
            ))}
        </div>
    ) : null;

/** Что нужно строке таблицы и карточке, кроме самого проекта */
export interface ProjectListProps {
    projects: ProjectShort[];
    activeTag: string | null;
    onToggleTag: (name: string) => void;
    renamingId: string | null;
    onRenamingChange: (projectId: string, editing: boolean) => void;
    onProjectClick: (
        e: React.MouseEvent<HTMLElement>,
        projectId: string
    ) => void;
    actionsFor: (project: ProjectShort) => MenuAction[];
}

/** Название с переименованием на месте; меню и карандаш правят его одинаково */
export const ListedProjectTitle = ({
    project,
    tooltipId,
    renamingId,
    onRenamingChange,
}: Pick<ProjectListProps, 'renamingId' | 'onRenamingChange'> & {
    project: ProjectShort;
    tooltipId?: string;
}) => (
    <ProjectTitle
        href={projectHref(project.projectId)}
        project={project}
        tooltipId={tooltipId}
        editing={renamingId === project.projectId}
        onEditingChange={(editing) =>
            onRenamingChange(project.projectId, editing)
        }
    />
);
