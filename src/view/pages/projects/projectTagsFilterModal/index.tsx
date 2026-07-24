import { useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Typography } from '../../../components/typography';
import { CheckIcon, CloseIcon } from '../../../icons';
import { colors } from '../../../styles/colors';
import {
    useAllAvailableTagKeys,
    useSelectedFilterTagKeys,
    useTagMap,
} from '../../../store/selectors/projectTags';
import { useDictionary } from '../../../store/selectors/translations';
import { TagChip } from '../tagChip';
import { DEFAULT_TAG_COLOR, orderTagKeysSelectedFirst } from '../tagColorUtils';
import { setSelectedFilterTagKeys } from '../../../store/slices/projects';
import { AppDispatch } from '../../../store';
import './style.scss';

type ProjectTagsFilterModalProps = {
    onClose: () => void;
};

export const ProjectTagsFilterModal = ({
    onClose,
}: ProjectTagsFilterModalProps) => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const selectedFilterTagKeys = useSelector(useSelectedFilterTagKeys);
    const allAvailableTagKeys = useSelector(useAllAvailableTagKeys);
    const tagMap = useSelector(useTagMap);
    const sortedTagKeys = useMemo(
        () =>
            orderTagKeysSelectedFirst(
                allAvailableTagKeys,
                selectedFilterTagKeys
            ),
        [allAvailableTagKeys, selectedFilterTagKeys]
    );
    const toggleTag = useCallback(
        (tagKey: string) => {
            const next = selectedFilterTagKeys.includes(tagKey)
                ? selectedFilterTagKeys.filter((item) => item !== tagKey)
                : [...selectedFilterTagKeys, tagKey];
            dispatch(setSelectedFilterTagKeys(next));
        },
        [dispatch, selectedFilterTagKeys]
    );

    return (
        <div className="project-tags-filter-dropdown">
            <div className="project-tags-filter-header">
                <Typography
                    className="project-tags-filter-title"
                    color={colors.black}
                    text={dictionary.projects.tags.filter_title}
                    type="body-large"
                />
                <button
                    type="button"
                    className="project-tags-filter-close-button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                    }}
                    aria-label="Close tags filter"
                >
                    <CloseIcon />
                </button>
            </div>
            <div className="project-tags-filter-list">
                {sortedTagKeys.length ? (
                    sortedTagKeys.map((tagKey) => {
                        const selected = selectedFilterTagKeys.includes(tagKey);
                        return (
                            <button
                                key={`filter-tag-${tagKey}`}
                                className="project-tags-filter-option"
                                data-selected={selected}
                                onClick={() => toggleTag(tagKey)}
                                type="button"
                            >
                                <TagChip
                                    className="tag-option-main"
                                    label={tagMap[tagKey]?.label ?? tagKey}
                                    color={
                                        tagMap[tagKey]?.color ??
                                        DEFAULT_TAG_COLOR
                                    }
                                />
                                {selected ? <CheckIcon /> : null}
                            </button>
                        );
                    })
                ) : (
                    <Typography
                        color={colors.gray30}
                        text={dictionary.projects.tags.filter_empty}
                        type="body-large"
                    />
                )}
            </div>
            <div className="project-tags-filter-actions">
                <button
                    className="projects-filter-clear-button"
                    type="button"
                    onClick={() => dispatch(setSelectedFilterTagKeys([]))}
                >
                    {dictionary.projects.tags.filter_clear}
                </button>
            </div>
        </div>
    );
};
