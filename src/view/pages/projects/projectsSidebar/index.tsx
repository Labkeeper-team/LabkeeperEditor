import { ReactNode } from 'react';
import { useSelector } from 'react-redux';
import classNames from 'classnames';

import './style.scss';
import { Button } from '../../../components/button';
import { PlusIcon } from '../../../icons';
import { useDictionary } from '../../../store/selectors/translations';
import { ProjectShort, ProjectTag } from '../../../../model/domain.ts';
import { ProjectActions } from '../projectActions';
import {
    AccessFilter,
    KnownTag,
    tagKey,
} from '../../../../viewModel/domain/projectsFilter.ts';
import { tagColors } from '../tagColors.ts';

/**
 * Боковая панель списка проектов по образцу Overleaf: создание проекта,
 * разделы по доступу и метки. Выбранный пункт сужает список, метки
 * правятся и удаляются из меню «⋯» прямо здесь
 */
export const ProjectsSidebar = (props: {
    projects: ProjectShort[];
    knownTags: KnownTag[];
    access: AccessFilter;
    tag: string | null;
    untagged: boolean;
    onAdd: () => void;
    /** Пока список грузится, нулей в счётчиках не показываем */
    showCounts?: boolean;
    onSelectAll: () => void;
    onSelectAccess: (access: AccessFilter) => void;
    onSelectTag: (key: string | null) => void;
    onSelectUntagged: () => void;
    onNewTag: () => void;
    onEditTag: (tag: ProjectTag) => void;
    onDeleteTag: (tag: ProjectTag) => void;
}) => {
    const dictionary = useSelector(useDictionary);
    const texts = dictionary.projects;
    const publicCount = props.projects.filter((p) => p.isPublic).length;
    const untaggedCount = props.projects.filter((p) => !p.tags?.length).length;
    const anyTagSelected = props.tag !== null || props.untagged;

    const item = (
        key: string,
        label: ReactNode,
        count: number,
        active: boolean,
        onClick: () => void,
        extra?: ReactNode
    ) => (
        <li
            key={key}
            className={classNames('projects-sidebar__item', {
                'projects-sidebar__item--active': active,
            })}
        >
            <button
                type="button"
                className="projects-sidebar__button"
                aria-pressed={active}
                onClick={onClick}
            >
                {label}
                {props.showCounts === false ? null : (
                    <span className="projects-sidebar__count">{count}</span>
                )}
            </button>
            {extra}
        </li>
    );

    return (
        <aside className="projects-sidebar">
            <Button
                classname="projects-sidebar__add"
                rounded
                color="blue"
                title={texts.add}
                minimize={false}
                titleIcon={() => <PlusIcon />}
                onPress={props.onAdd}
            />

            <ul className="projects-sidebar__list" aria-label={texts.access}>
                {item(
                    'all',
                    <span className="projects-sidebar__label">
                        {texts.sidebar.all_projects}
                    </span>,
                    props.projects.length,
                    props.access === 'all' && !anyTagSelected,
                    props.onSelectAll
                )}
                {item(
                    'public',
                    <span className="projects-sidebar__label">
                        {texts.sidebar.public_projects}
                    </span>,
                    publicCount,
                    props.access === 'public',
                    () => props.onSelectAccess('public')
                )}
                {item(
                    'private',
                    <span className="projects-sidebar__label">
                        {texts.sidebar.private_projects}
                    </span>,
                    props.projects.length - publicCount,
                    props.access === 'private',
                    () => props.onSelectAccess('private')
                )}
            </ul>

            <div className="projects-sidebar__section">
                <span>{texts.tags}</span>
            </div>
            <button
                type="button"
                className="projects-sidebar__new-tag"
                onClick={props.onNewTag}
            >
                <PlusIcon />
                {texts.sidebar.new_tag}
            </button>

            <ul className="projects-sidebar__list" aria-label={texts.tags}>
                {props.knownTags.map((tag) => {
                    const key = tagKey(tag.name);
                    const active = props.tag === key;
                    return item(
                        `tag-${key}`,
                        <>
                            <span
                                className="projects-sidebar__dot"
                                style={{ background: tagColors(tag.color).dot }}
                            />
                            <span
                                className="projects-sidebar__label"
                                title={tag.name}
                            >
                                {tag.name}
                            </span>
                        </>,
                        tag.count,
                        active,
                        // повторный щелчок по выбранной метке снимает выбор
                        () => props.onSelectTag(active ? null : key),
                        <ProjectActions
                            label={`${texts.sidebar.tag_menu}: ${tag.name}`}
                            actions={[
                                {
                                    key: 'edit',
                                    label: texts.sidebar.edit,
                                    onSelect: () => props.onEditTag(tag),
                                },
                                {
                                    key: 'delete',
                                    label: texts.actions.delete,
                                    danger: true,
                                    onSelect: () => props.onDeleteTag(tag),
                                },
                            ]}
                        />
                    );
                })}
                {props.knownTags.length
                    ? item(
                          'untagged',
                          <span className="projects-sidebar__label projects-sidebar__label--muted">
                              {texts.no_tags}
                          </span>,
                          untaggedCount,
                          props.untagged,
                          props.onSelectUntagged
                      )
                    : null}
            </ul>
        </aside>
    );
};
