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
    PROJECT_TAGS_MAX_COUNT,
    ProjectShort,
    ProjectTag,
} from '../../../../model/domain.ts';
import {
    KnownTag,
    TAG_COLORS,
    defaultTagColor,
    tagKey,
    tagColorName,
} from '../../../../viewModel/domain/projectsFilter.ts';
import { toHexColor } from '../tagColors.ts';

/** С какого числа проектов в окне появляется поиск по ним */
const PROJECT_SEARCH_FROM = 8;

/**
 * Создание и правка метки из боковой панели, как в Overleaf: имя, цвет
 * и проекты, на которых она стоит. Метка хранится только в проектах,
 * поэтому без проектов её не сохранить
 */
export const TagEditModal = (props: {
    /** Метка, которую правят; без неё окно создаёт новую */
    tag?: ProjectTag;
    projects: ProjectShort[];
    knownTags: KnownTag[];
    /** Метку сохранили под этим именем: выбор в списке должен пойти за ней */
    onSaved?: (previousName: string | undefined, name: string) => void;
    onClose: () => void;
}) => {
    const dictionary = useSelector(useDictionary);
    const texts = dictionary.projects.sidebar;
    const dispatch = useDispatch<AppDispatch>();
    const inputRef = useRef<HTMLInputElement>(null);

    const [name, setName] = useState(props.tag?.name ?? '');
    // цвет, выбранный руками. Пока его нет, уходит исходный цвет метки как
    // есть: приведённый к hex («red» в «#ff0000») отличался бы от хранимого,
    // и «Сохранить» без правок переписал бы все проекты с этой меткой
    const [color, setColor] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState<Set<string>>(() => {
        if (!props.tag) {
            return new Set<string>();
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

    // отмеченные при открытии проекты сверху; порядок не прыгает при щелчках
    const [order] = useState(() => [
        ...props.projects.filter((p) => selected.has(p.projectId)),
        ...props.projects.filter((p) => !selected.has(p.projectId)),
    ]);
    const hadTag = useMemo(() => {
        const key = props.tag ? tagKey(props.tag.name) : null;
        return new Set(
            props.projects
                .filter(
                    (p) =>
                        key !== null &&
                        p.tags?.some((t) => tagKey(t.name) === key)
                )
                .map((p) => p.projectId)
        );
    }, [props.projects, props.tag]);
    const visibleProjects = order.filter(
        (p) =>
            !query.trim() ||
            p.title
                .toLocaleLowerCase()
                .includes(query.trim().toLocaleLowerCase())
    );
    const limitText = dictionary.projects.tags_modal.limit.replace(
        '${max}',
        () => `${PROJECT_TAGS_MAX_COUNT}`
    );
    /** Новую метку не поставить туда, где меток уже предел */
    const isFull = (project: ProjectShort) =>
        !hadTag.has(project.projectId) &&
        (project.tags?.length ?? 0) >= PROJECT_TAGS_MAX_COUNT;

    // цвет метки не из палитры показываем отдельным образцом в начале
    const palette = useMemo(() => {
        const current = props.tag ? toHexColor(props.tag.color) : null;
        return current && !(TAG_COLORS as readonly string[]).includes(current)
            ? [current, ...TAG_COLORS]
            : [...TAG_COLORS];
    }, [props.tag]);

    const effectiveColor = color ?? props.tag?.color ?? defaultTagColor(name);
    // отмечаем образец по приведённому цвету: с сервера он может прийти не hex
    const shownColor = toHexColor(effectiveColor) ?? effectiveColor;
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
        props.onSaved?.(props.tag?.name, name.trim());
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
                        style={{ background: shownColor }}
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
                <div
                    className="tag-edit-modal__colors"
                    role="radiogroup"
                    aria-label={texts.tag_color}
                >
                    {palette.map((swatch) => (
                        <button
                            key={swatch}
                            type="button"
                            role="radio"
                            aria-checked={swatch === shownColor}
                            aria-label={
                                texts.tag_color_names[
                                    tagColorName(swatch) ?? 'own'
                                ]
                            }
                            className={classNames('tag-edit-modal__swatch', {
                                'tag-edit-modal__swatch--active':
                                    swatch === shownColor,
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
                {props.projects.length >= PROJECT_SEARCH_FROM ? (
                    <input
                        className="tag-edit-modal__search"
                        type="search"
                        value={query}
                        placeholder={dictionary.projects.search_placeholder}
                        aria-label={dictionary.projects.search_placeholder}
                        onChange={(e) => setQuery(e.target.value)}
                        // Enter в поиске только ищет, а не сохраняет метку
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                            }
                        }}
                    />
                ) : null}
                <div className="tag-edit-modal__projects">
                    {visibleProjects.map((project) => {
                        const full =
                            isFull(project) && !selected.has(project.projectId);
                        return (
                            <label
                                key={project.projectId}
                                className={classNames(
                                    'tag-edit-modal__project',
                                    {
                                        'tag-edit-modal__project--disabled':
                                            full,
                                    }
                                )}
                                title={full ? limitText : project.title}
                            >
                                <input
                                    type="checkbox"
                                    checked={selected.has(project.projectId)}
                                    disabled={full}
                                    onChange={() => toggle(project.projectId)}
                                />
                                <span>{project.title}</span>
                            </label>
                        );
                    })}
                    {!visibleProjects.length ? (
                        <span className="tag-edit-modal__empty">
                            {dictionary.projects.no_matches}
                        </span>
                    ) : null}
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
