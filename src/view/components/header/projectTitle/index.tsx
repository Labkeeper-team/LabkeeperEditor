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
import { useIsMobile } from '../../../hooks/useMobile';

export const ProjectTitle = () => {
    const project = useSelector(useCurrentProject);
    const [draftTitle, setDraftTitle] = useState(project?.title ?? '');
    const editMode = useSelector(
        (state: StorageState) => state.settings.editModeForProjectTitle
    );
    const dispatch = useDispatch<AppDispatch>();
    const inputRef = useRef<HTMLInputElement>();
    const projectIsReadonly = useSelector(useIsProjectReadonly);
    const isMobile = useIsMobile();
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
        if (editMode || isMobile) {
            return;
        }
        setDraftTitle(project.title);
        setEditMode(true);
        setTimeout(() => {
            inputRef?.current?.select();
        }, 200);
    };

    useEffect(() => {
        if (isMobile && editMode) {
            setEditMode(false);
            return;
        }
    }, [editMode, isMobile, setEditMode]);

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
        <div className="change-title-container">
            <input
                ref={inputRef as never}
                value={editMode ? draftTitle : project.title}
                onChange={
                    editMode ? (e) => setDraftTitle(e.target.value) : undefined
                }
                onBlur={editMode ? onInputBlur : undefined}
                onKeyDown={editMode ? onKeyDown : undefined}
                disabled={!editMode}
                className={`${classNames('change-title-input', { disabled: !editMode })}`}
            />
            {!projectIsReadonly && !isMobile && (
                <div
                    onClick={onPressPencil}
                    className={classNames('change-titlepress-button', {
                        'edit-mode-on': editMode,
                    })}
                >
                    <PencilIcon />
                </div>
            )}
        </div>
    );
};
