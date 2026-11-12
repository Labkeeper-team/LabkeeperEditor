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
import { TagChip } from '../tagChip';
import {
    KnownTag,
    TAG_COLORS,
    defaultTagColor,
    tagKey,
    uniqueTags,
} from '../projectsFilter.ts';

/**
 * Метки одного проекта. Правки копятся здесь и уходят одним запросом по
 * «Сохранить»: сервер заменяет список целиком
 */
export const TagsModal = (props: {
    project: ProjectShort;
    knownTags: KnownTag[];
    onClose: () => void;
}) => {
    const dictionary = useSelector(useDictionary);
    const texts = dictionary.projects.tags_modal;
    const dispatch = useDispatch<AppDispatch>();
    const inputRef = useRef<HTMLInputElement>(null);

    // что окно показало при открытии: правка уходит как разница с ним
    const [opened] = useState<ProjectTag[]>(() =>
        uniqueTags(props.project.tags)
    );
    const [tags, setTags] = useState<ProjectTag[]>(opened);
    const [name, setName] = useState('');
    // цвет, выбранный руками; пока его нет, цвет берётся от имени
    const [pickedColor, setPickedColor] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const knownByKey = useMemo(
        () => new Map(props.knownTags.map((tag) => [tagKey(tag.name), tag])),
        [props.knownTags]
    );
    const ownKeys = useMemo(
        () => new Set(tags.map((tag) => tagKey(tag.name))),
        [tags]
    );
    // такая метка уже есть у других проектов: берём её цвет, чтобы фильтр был однородным
    const existing = knownByKey.get(tagKey(name));
    const color = pickedColor ?? existing?.color ?? defaultTagColor(name || '');
    const suggestions = props.knownTags.filter(
        (tag) =>
            !ownKeys.has(tagKey(tag.name)) &&
            (!name.trim() || tagKey(tag.name).includes(tagKey(name)))
    );
    const full = tags.length >= PROJECT_TAGS_MAX_COUNT;

    const addTag = (tag: ProjectTag) => {
        // метка уже есть у других проектов: берём её написание, иначе «физика»
        // встала бы рядом с «Физика» отдельным вариантом
        const trimmed =
            knownByKey.get(tagKey(tag.name.trim()))?.name ?? tag.name.trim();
        if (!trimmed) {
            return;
        }
        if (ownKeys.has(tagKey(trimmed))) {
            setError(texts.duplicate);
            return;
        }
        if (full) {
            setError(
                texts.limit.replace('${max}', `${PROJECT_TAGS_MAX_COUNT}`)
            );
            return;
        }
        setTags([...tags, { name: trimmed, color: tag.color }]);
        setName('');
        setPickedColor(null);
        setError(null);
        inputRef.current?.focus();
    };

    const onSubmit = (e: FormEvent) => {
        e.preventDefault();
        addTag({ name, color });
    };

    const onSave = () => {
        // недописанная метка в поле тоже сохраняется: её явно хотели добавить
        const pending =
            name.trim() && !ownKeys.has(tagKey(name)) && !full
                ? [...tags, { name: existing?.name ?? name.trim(), color }]
                : tags;
        dispatch(
            controller.onProjectTagsChangeRequest({
                projectId: props.project.projectId,
                tags: pending,
                opened,
            })
        );
        props.onClose();
    };

    return (
        <div className="tags-modal">
            <Typography text={texts.title} type="h2" color={colors.gray10} />
            <div className="tags-modal__project" title={props.project.title}>
                {props.project.title}
            </div>

            <div className="tags-modal__current">
                {tags.length ? (
                    // имена различаются хотя бы регистром: «Физика» и «физика» две метки
                    tags.map((tag, index) => (
                        <TagChip
                            key={tag.name}
                            tag={tag}
                            removeLabel={dictionary.delete}
                            onRemove={() => {
                                setTags(tags.filter((_, i) => i !== index));
                                setError(null);
                            }}
                        />
                    ))
                ) : (
                    <span className="tags-modal__empty">{texts.empty}</span>
                )}
            </div>

            <form className="tags-modal__add" onSubmit={onSubmit}>
                <input
                    ref={inputRef}
                    className="tags-modal__input"
                    value={name}
                    maxLength={PROJECT_TAG_MAX_LENGTH}
                    placeholder={texts.add_placeholder}
                    aria-label={texts.add_placeholder}
                    disabled={full}
                    onChange={(e) => {
                        setName(e.target.value);
                        setError(null);
                    }}
                />
                <button
                    type="submit"
                    className="tags-modal__add-button"
                    disabled={!name.trim() || full}
                >
                    {texts.add}
                </button>
            </form>
            <div className="tags-modal__colors" role="radiogroup">
                {TAG_COLORS.map((swatch) => (
                    <button
                        key={swatch}
                        type="button"
                        role="radio"
                        aria-checked={swatch === color}
                        aria-label={swatch}
                        className={classNames('tags-modal__swatch', {
                            'tags-modal__swatch--active': swatch === color,
                        })}
                        style={{ background: swatch }}
                        onClick={() => setPickedColor(swatch)}
                    />
                ))}
            </div>
            {error ? <div className="tags-modal__error">{error}</div> : null}

            {suggestions.length ? (
                <div className="tags-modal__suggestions">
                    <span className="tags-modal__label">
                        {texts.suggestions}
                    </span>
                    <div className="tags-modal__suggestions-list">
                        {suggestions.map((tag) => (
                            <TagChip
                                key={tagKey(tag.name)}
                                tag={tag}
                                small
                                onClick={() => addTag(tag)}
                            />
                        ))}
                    </div>
                </div>
            ) : null}

            <div className="tags-modal__buttons">
                <Button
                    classname="tags-modal__button"
                    title={texts.cancel}
                    color="gray"
                    rounded
                    minimize={false}
                    onPress={props.onClose}
                />
                <Button
                    classname="tags-modal__button"
                    title={texts.save}
                    color="blue"
                    rounded
                    minimize={false}
                    onPress={onSave}
                />
            </div>
        </div>
    );
};
