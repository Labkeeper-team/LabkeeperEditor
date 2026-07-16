import { formatDistance } from 'date-fns';
import { enGB, ru } from 'date-fns/locale';
import React, {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';

import './style.scss';
import { Typography } from '../../../components/typography';
import { PlusIcon } from '../../../icons';
import { ProjectShort } from '../../../../model/domain';
import { colors } from '../../../styles/colors';
import {
    useProjectTagKeysByProject,
    useTagMap,
} from '../../../store/selectors/projectTags';
import {
    useCurrentLanguage,
    useDictionary,
} from '../../../store/selectors/translations';
import { AppDispatch } from '../../../store';
import { controller } from '../../../../main.tsx';
import { ProjectTitle } from '../projectTitle';
import { ProjectTagsModal } from '../projectTagsModal';
import { TagChip } from '../tagChip';
import { DEFAULT_TAG_COLOR } from '../tagColorUtils';

type ProjectRowProps = {
    project: ProjectShort;
    isTagPickerOpen: boolean;
    tagsListBoundaryRef: React.RefObject<HTMLElement | null>;
    onTagPickerButtonClick: (e: React.MouseEvent<HTMLElement, unknown>) => void;
    onCloseTagsUi: () => void;
    onDeleteClick: (
        e: React.MouseEvent<HTMLElement, unknown>,
        project: ProjectShort
    ) => void;
};

export const ProjectRow = ({
    project,
    isTagPickerOpen,
    tagsListBoundaryRef,
    onTagPickerButtonClick,
    onCloseTagsUi,
    onDeleteClick,
}: ProjectRowProps) => {
    const tagsCellRef = useRef<HTMLDivElement | null>(null);
    const tagButtonRef = useRef<HTMLButtonElement | null>(null);
    const [isSingleLineTags, setIsSingleLineTags] = useState(true);
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const lang = useSelector(useCurrentLanguage);
    const tagMap = useSelector(useTagMap);
    const projectTagKeysByProject = useSelector(useProjectTagKeysByProject);
    const projectTagKeys = projectTagKeysByProject[project.projectId] ?? [];
    const projectTagKeysSignature = projectTagKeys.join('\0');

    const locale = useMemo(() => {
        switch (lang) {
            case 'ru': {
                return ru;
            }
            default: {
                return enGB;
            }
        }
    }, [lang]);

    const recalculateTagsLayout = useCallback(() => {
        const cell = tagsCellRef.current;
        if (!cell) {
            return;
        }
        const children = Array.from(cell.children) as HTMLElement[];
        const nextSingleLine =
            children.length <= 1 ||
            children.every(
                (child) => child.offsetTop === children[0].offsetTop
            );
        setIsSingleLineTags((prev) =>
            prev === nextSingleLine ? prev : nextSingleLine
        );
    }, []);

    useLayoutEffect(() => {
        if (tagsCellRef.current) {
            tagsCellRef.current.scrollTop = 0;
        }
        recalculateTagsLayout();
    }, [projectTagKeysSignature, recalculateTagsLayout]);

    useEffect(() => {
        const cell = tagsCellRef.current;
        if (!cell || typeof ResizeObserver === 'undefined') {
            return;
        }
        const observer = new ResizeObserver(() => {
            recalculateTagsLayout();
        });
        observer.observe(cell);
        return () => observer.disconnect();
    }, [recalculateTagsLayout]);

    return (
        <tr
            onClick={() => {
                onCloseTagsUi();
                if (project.projectId) {
                    dispatch(
                        controller.onRowClickedInProjectsListRequest({
                            projectId: project.projectId,
                        })
                    );
                }
            }}
        >
            <td className="project-title-cell">
                <ProjectTitle project={project} />
            </td>
            <td>
                <Typography
                    color={colors.gray30}
                    text={formatDistance(
                        new Date(),
                        new Date(project.lastModified!),
                        {
                            locale,
                        }
                    )}
                    type="body-large"
                />
            </td>
            <td>
                <div
                    className={`project-tags-cell ${
                        isSingleLineTags ? 'single-line' : ''
                    }`}
                    ref={tagsCellRef}
                >
                    {projectTagKeys.length ? (
                        projectTagKeys.map((tagKey) => (
                            <TagChip
                                key={`${project.projectId}-${tagKey}`}
                                label={tagMap[tagKey]?.label ?? tagKey}
                                color={
                                    tagMap[tagKey]?.color ?? DEFAULT_TAG_COLOR
                                }
                            />
                        ))
                    ) : (
                        <Typography
                            color={colors.gray30}
                            text="—"
                            type="body-large"
                        />
                    )}
                </div>
            </td>
            <td>
                <div className="project-actions-container">
                    <div className="project-tags-anchor">
                        <button
                            type="button"
                            ref={tagButtonRef}
                            onClick={onTagPickerButtonClick}
                            className="project-tags-button"
                        >
                            {dictionary.projects.tags.add}
                        </button>
                        {isTagPickerOpen ? (
                            <ProjectTagsModal
                                onClose={onCloseTagsUi}
                                projectId={project.projectId}
                                triggerRef={tagButtonRef}
                                boundaryRef={tagsListBoundaryRef}
                            />
                        ) : null}
                    </div>
                    <div
                        onClick={(e) => onDeleteClick(e, project)}
                        className="delete-project-container"
                    >
                        <div className="delete-icon">
                            <PlusIcon />
                        </div>
                        <Typography
                            color={colors.black}
                            text={dictionary.delete}
                        />
                        <div style={{ width: 10 }} />
                    </div>
                </div>
            </td>
        </tr>
    );
};
