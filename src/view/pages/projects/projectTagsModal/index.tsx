import React, { useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Typography } from '../../../components/typography';
import { CheckIcon, CloseIcon, PlusIcon } from '../../../icons';
import { colors } from '../../../styles/colors';
import { useDropdownPlacement } from '../../../hooks/useDropdownPlacement';
import { ProjectTagColorModal } from '../projectTagColorModal';
import { TagChip } from '../tagChip';
import { useDictionary } from '../../../store/selectors/translations';
import { AppDispatch } from '../../../store';
import {
    useAllAvailableTagKeys,
    useNextTagColor,
    useNextTagColorInput,
    useProjectTagKeysByProject,
    useTagMap,
} from '../../../store/selectors/projectTags';
import { controller } from '../../../../main.tsx';
import {
    DEFAULT_TAG_COLOR,
    getNextSuggestedTagColor,
    normalizeColorInput,
    normalizeTagLabel,
    orderTagKeysSelectedFirst,
} from '../tagColorUtils';
import {
    setNextTagColor,
    setNextTagColorInput,
} from '../../../store/slices/projects';
import './style.scss';

type ProjectTagsModalProps = {
    onClose: () => void;
    projectId: string;
    triggerRef: React.RefObject<HTMLElement | null>;
    boundaryRef: React.RefObject<HTMLElement | null>;
};

export const ProjectTagsModal = ({
    onClose,
    projectId,
    triggerRef,
    boundaryRef,
}: ProjectTagsModalProps) => {
    const dropdownRef = useRef<HTMLDivElement | null>(null);
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const nextTagColor = useSelector(useNextTagColor);
    const nextTagColorInput = useSelector(useNextTagColorInput);
    const allAvailableTagKeys = useSelector(useAllAvailableTagKeys);
    const tagMap = useSelector(useTagMap);
    const projectTagKeysByProject = useSelector(useProjectTagKeysByProject);
    const [showColorModal, setShowColorModal] = useState(false);
    const [newTagValue, setNewTagValue] = useState('');
    const selectedTagsSet = useMemo(
        () => new Set(projectTagKeysByProject[projectId] ?? []),
        [projectTagKeysByProject, projectId]
    );
    const orderedProjectTags = useMemo(
        () => orderTagKeysSelectedFirst(allAvailableTagKeys, selectedTagsSet),
        [allAvailableTagKeys, selectedTagsSet]
    );
    const contentKey = `${orderedProjectTags.length}:${showColorModal ? 1 : 0}`;
    const { placement, isReady } = useDropdownPlacement({
        triggerRef,
        dropdownRef,
        boundaryRef,
        contentKey,
    });

    const addNewTag = () => {
        const normalizedTag = normalizeTagLabel(newTagValue);
        if (!projectId || !normalizedTag) {
            setNewTagValue('');
            return;
        }

        const tagKey = normalizedTag.toLocaleLowerCase();
        if (selectedTagsSet.has(tagKey)) {
            setNewTagValue('');
            return;
        }
        const existingColor = tagMap[tagKey]?.color;
        const fromInput = normalizeColorInput(nextTagColorInput ?? '');
        const chosenColor =
            existingColor ?? fromInput ?? nextTagColor ?? DEFAULT_TAG_COLOR;
        dispatch(
            controller.onAddTagToProjectRequest({
                projectId,
                tagLabel: normalizedTag,
                color: chosenColor,
            })
        );
        const usedColors = Object.values(tagMap).map((t) => t.color);
        const nextSuggestedColor = getNextSuggestedTagColor(
            [...usedColors, chosenColor],
            chosenColor
        );
        dispatch(setNextTagColor(nextSuggestedColor));
        dispatch(setNextTagColorInput(nextSuggestedColor));
        setNewTagValue('');
    };

    const toggleTag = (tagKey: string) => {
        const alreadySelected = selectedTagsSet.has(tagKey);
        if (alreadySelected) {
            dispatch(
                controller.onRemoveTagFromProjectRequest({
                    projectId,
                    tagLabel: tagMap[tagKey]?.label ?? tagKey,
                })
            );
            return;
        }
        dispatch(
            controller.onAddTagToProjectRequest({
                projectId,
                tagLabel: tagMap[tagKey]?.label ?? tagKey,
                color: tagMap[tagKey]?.color ?? DEFAULT_TAG_COLOR,
            })
        );
    };

    const onTagEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.stopPropagation();
            addNewTag();
        }
    };

    return (
        <div
            ref={dropdownRef}
            className={`project-tags-dropdown ${
                placement === 'top' ? 'open-up' : 'open-down'
            }`}
            style={{ visibility: isReady ? 'visible' : 'hidden' }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="project-tags-dropdown-header">
                <Typography
                    className="project-tags-hint"
                    color={colors.gray30}
                    type="body-large"
                    text={dictionary.projects.tags.hint}
                />
                <button
                    type="button"
                    className="project-tags-close-button"
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowColorModal(false);
                        setNewTagValue('');
                        onClose();
                    }}
                    aria-label="Close tags list"
                >
                    <CloseIcon />
                </button>
            </div>
            <div className="project-tags-scroll">
                {orderedProjectTags.length ? (
                    orderedProjectTags.map((tagKey) => (
                        <button
                            key={`${projectId}-${tagKey}-available`}
                            type="button"
                            className="project-tag-option"
                            data-selected={selectedTagsSet.has(tagKey)}
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleTag(tagKey);
                            }}
                        >
                            <TagChip
                                className="tag-option-main"
                                label={tagMap[tagKey]?.label ?? tagKey}
                                color={
                                    tagMap[tagKey]?.color ?? DEFAULT_TAG_COLOR
                                }
                            />
                            {selectedTagsSet.has(tagKey) ? (
                                <span className="project-tag-option-check">
                                    <CheckIcon />
                                </span>
                            ) : null}
                        </button>
                    ))
                ) : (
                    <Typography
                        color={colors.gray30}
                        type="body-large"
                        text={dictionary.projects.tags.empty}
                    />
                )}
            </div>
            <div className="project-tags-input-row">
                <div className="project-tags-new-input-actions">
                    <button
                        type="button"
                        className="project-tags-color-picker-button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowColorModal((prev) => !prev);
                        }}
                        aria-label="Open color palette"
                    >
                        <span
                            className="project-tags-color-preview"
                            style={{
                                backgroundColor:
                                    nextTagColor ?? DEFAULT_TAG_COLOR,
                            }}
                        />
                    </button>
                    <input
                        value={newTagValue}
                        onChange={(e) => setNewTagValue(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={onTagEnter}
                        className="project-tags-input"
                        placeholder={dictionary.projects.tags.new_placeholder}
                    />
                    <button
                        type="button"
                        className="project-tags-add-button"
                        onClick={(e) => {
                            e.stopPropagation();
                            addNewTag();
                        }}
                        aria-label={dictionary.projects.tags.add_new}
                    >
                        <PlusIcon />
                    </button>
                </div>
                {showColorModal ? <ProjectTagColorModal /> : null}
            </div>
        </div>
    );
};
