import { useDispatch, useSelector } from 'react-redux';
import {
    useCurrentProject,
    useIsProjectReadonly,
} from '../../../store/selectors/program';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PencilIcon } from '../../../icons';

import './style.scss';
import classNames from 'classnames';
import { AppDispatch, StorageState } from '../../../store';
import { setEditModeForProjectTitle } from '../../../store/slices/settings';
import { controller } from '../../../../main.tsx';
import { PROJECT_TITLE_MAX_LENGTH } from '../../../../model/domain.ts';
import { Tooltip } from 'react-tooltip';
import { Typography } from '../../typography';
import { colors } from '../../../styles/colors.ts';
import { isElementTextTruncated } from '../../../helpers/index.ts';

const PROJECT_TITLE_TOOLTIP_ID = 'header-project-title-tooltip';

export const ProjectTitle = ({ isMobile }: { isMobile: boolean }) => {
    const project = useSelector(useCurrentProject);
    const [draftTitle, setDraftTitle] = useState(project?.title ?? '');
    const editMode = useSelector(
        (state: StorageState) => state.settings.editModeForProjectTitle
    );
    const dispatch = useDispatch<AppDispatch>();
    const inputRef = useRef<HTMLInputElement>();
    const projectIsReadonly = useSelector(useIsProjectReadonly);
    const setEditMode = useCallback(
        (value: boolean) => {
            dispatch(setEditModeForProjectTitle(value));
        },
        [dispatch]
    );

    const onInputBlur = useCallback(async () => {
        if (!project?.projectId || !draftTitle) {
            return;
        }
        dispatch(
            controller.onProjectTitleChangedRequest({
                projectId: project.projectId,
                title: draftTitle,
                okCallback: () => {
                    setDraftTitle(draftTitle);
                    setEditMode(false);
                },
                failCallback: () => {
                    setDraftTitle(project.title);
                    setEditMode(false);
                },
            })
        );
    }, [project, draftTitle, dispatch, setEditMode]);

    const onPressPencil = () => {
        if (editMode) {
            return;
        }
        setDraftTitle(project.title);
        setEditMode(true);
        setTimeout(() => {
            inputRef?.current?.select();
        }, 200);
    };

    useEffect(() => {
        if (!editMode) {
            if (window.getSelection) {
                window.getSelection()?.removeAllRanges();
            }
            inputRef?.current?.blur();
        }
    }, [editMode]);

    const onKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        }
    };

    if (!project || !project.title) {
        return null;
    }

    return (
        <>
            <div
                className={classNames('change-title-container', {
                    'change-title-container--readonly': projectIsReadonly,
                })}
            >
                {projectIsReadonly ? (
                    <Typography
                        className="change-title-readonly"
                        color={colors.white}
                        data-tooltip-content={project.title}
                        data-tooltip-id={PROJECT_TITLE_TOOLTIP_ID}
                        tabIndex={0}
                        text={project.title}
                        type="body-large"
                    />
                ) : (
                    <input
                        ref={inputRef as never}
                        value={editMode ? draftTitle : project.title}
                        onChange={
                            editMode
                                ? (e) => setDraftTitle(e.target.value)
                                : undefined
                        }
                        onBlur={editMode ? onInputBlur : undefined}
                        onKeyDown={editMode ? onKeyDown : undefined}
                        disabled={!editMode}
                        maxLength={PROJECT_TITLE_MAX_LENGTH}
                        className={`${classNames('change-title-input', { disabled: !editMode })}`}
                    />
                )}
                {!projectIsReadonly &&
                    (editMode ? (
                        <div className="change-title-character-count">
                            {draftTitle.length} / {PROJECT_TITLE_MAX_LENGTH}
                        </div>
                    ) : (
                        <div
                            onClick={onPressPencil}
                            className="change-titlepress-button"
                        >
                            <PencilIcon />
                        </div>
                    ))}
            </div>
            <Tooltip
                id={PROJECT_TITLE_TOOLTIP_ID}
                closeEvents={isMobile ? {} : { blur: true, mouseleave: true }}
                disableTooltip={(anchor) => !isElementTextTruncated(anchor)}
                globalCloseEvents={{
                    clickOutsideAnchor: true,
                    escape: true,
                    resize: true,
                    scroll: true,
                }}
                openEvents={
                    isMobile
                        ? { click: true }
                        : { focus: true, mouseenter: true }
                }
                place="bottom"
                positionStrategy="fixed"
                variant="light"
                style={{
                    maxWidth: 'min(480px, calc(100vw - 32px))',
                    overflowWrap: 'anywhere',
                    zIndex: 1000,
                }}
                wrapper="div"
            />
        </>
    );
};
