import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import classNames from 'classnames';

import './style.scss';
import { Typography } from '../../../components/typography';
import { Button } from '../../../components/button';
import { colors } from '../../../styles/colors';
import { useDictionary } from '../../../store/selectors/translations';
import { AppDispatch } from '../../../store';
import { controller } from '../../../../main.tsx';
import {
    PROJECT_TAG_MAX_LENGTH,
    ProjectShort,
    ProjectTag,
} from '../../../../model/domain.ts';
import {
    KnownTag,
    TAG_COLORS,
    defaultTagColor,
    tagKey,
} from '../projectsFilter.ts';

/**
 * Создание и правка метки из боковой панели, как в Overleaf: имя, цвет
 * и проекты, на которых она стоит. Метка хранится только в проектах,
 * поэтому без проектов её не сохранить
 */
export const TagEditModal = (props: {
    /** Метка, которую правят; без неё окно создаёт новую */
    tag?: ProjectTag;
    /** Проекты, отмеченные сразу, например текущая выборка списка */
    preselected?: string[];
    projects: ProjectShort[];
    knownTags: KnownTag[];
    onClose: () => void;
}) => {
    const dictionary = useSelector(useDictionary);
    const texts = dictionary.projects.sidebar;
    const dispatch = useDispatch<AppDispatch>();
    const inputRef = useRef<HTMLInputElement>(null);

    const [name, setName] = useState(props.tag?.name ?? '');
    const [color, setColor] = useState<string | null>(props.tag?.color ?? null);
    const [selected, setSelected] = useState<Set<string>>(() => {
        if (!props.tag) {
            return new Set(props.preselected ?? []);
        }
        const key = tagKey(props.tag.name);
        return new Set(
            props.projects
                .filter((p) => p.tags?.some((t) => tagKey(t.name) === key))
                .map((p) => p.projectId)
        );
    });

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const effectiveColor = color ?? defaultTagColor(name);
    const takenBy = useMemo(() => {
        const key = tagKey(name);
        if (!key || (props.tag && tagKey(props.tag.name) === key)) {
            return undefined;
        }
        return props.knownTags.find((t) => tagKey(t.name) === key);
    }, [name, props.knownTags, props.tag]);

    const canSave = !!name.trim() && !takenBy && selected.size > 0;

    const toggle = (projectId: string) => {
        const next = new Set(selected);
        if (next.has(projectId)) {
            next.delete(projectId);
        } else {
            next.add(projectId);
        }
        setSelected(next);
    };

    const onSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!canSave) {
            return;
        }
        dispatch(
            controller.onTagSaveRequest({
                previousName: props.tag?.name,
                name: name.trim(),
                color: effectiveColor,
                projectIds: [...selected],
            })
        );
        props.onClose();
    };

    return (
        <form className="tag-edit-modal" onSubmit={onSubmit}>
            <Typography
                text={props.tag ? texts.edit_tag : texts.new_tag}
                type="h2"
                color={colors.gray10}
            />

            <label className="tag-edit-modal__field">
                <span className="tag-edit-modal__label">{texts.tag_name}</span>
                <span className="tag-edit-modal__name">
                    <span
                        className="tag-edit-modal__dot"
                        style={{ background: effectiveColor }}
                    />
                    <input
                        ref={inputRef}
                        value={name}
                        maxLength={PROJECT_TAG_MAX_LENGTH}
                        onChange={(e) => setName(e.target.value)}
                    />
                </span>
            </label>
            {takenBy ? (
                <div className="tag-edit-modal__error">{texts.tag_exists}</div>
            ) : null}

            <div className="tag-edit-modal__field">
                <span className="tag-edit-modal__label">{texts.tag_color}</span>
                <div className="tag-edit-modal__colors" role="radiogroup">
                    {TAG_COLORS.map((swatch) => (
                        <button
                            key={swatch}
                            type="button"
                            role="radio"
                            aria-checked={swatch === effectiveColor}
                            aria-label={swatch}
                            className={classNames('tag-edit-modal__swatch', {
                                'tag-edit-modal__swatch--active':
                                    swatch === effectiveColor,
                            })}
                            style={{ background: swatch }}
                            onClick={() => setColor(swatch)}
                        />
                    ))}
                </div>
            </div>

            <div className="tag-edit-modal__field">
                <span className="tag-edit-modal__label">
                    {texts.tag_projects}
                    <span className="tag-edit-modal__counter">
                        {selected.size}
                    </span>
                </span>
                <div className="tag-edit-modal__projects">
                    {props.projects.map((project) => (
                        <label
                            key={project.projectId}
                            className="tag-edit-modal__project"
                        >
                            <input
                                type="checkbox"
                                checked={selected.has(project.projectId)}
                                onChange={() => toggle(project.projectId)}
                            />
                            <span>{project.title}</span>
                        </label>
                    ))}
                </div>
                {!selected.size ? (
                    <span className="tag-edit-modal__hint">
                        {texts.tag_projects_hint}
                    </span>
                ) : null}
            </div>

            <div className="tag-edit-modal__buttons">
                <Button
                    classname="tag-edit-modal__button"
                    title={dictionary.projects.tags_modal.cancel}
                    color="gray"
                    rounded
                    minimize={false}
                    onPress={props.onClose}
                />
                <Button
                    classname="tag-edit-modal__button"
                    buttonType="submit"
                    title={dictionary.projects.tags_modal.save}
                    color="blue"
                    rounded
                    minimize={false}
                    disabled={!canSave}
                />
            </div>
        </form>
    );
};
