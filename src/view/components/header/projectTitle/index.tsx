import { useDispatch, useSelector } from 'react-redux';
import {
    useCurrentProject,
    useIsProjectReadonly,
} from '../../../../viewModel/store/selectors/program';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PencilIcon } from '../../../icons';

import './style.scss';
import classNames from 'classnames';
import { AppDispatch, StorageState } from '../../../../viewModel/store';
import { setEditModeForProjectTitle } from '../../../../viewModel/store/slices/settings';
import { onProjectTitleChangedRequest } from '../../../../controller';

export const ProjectTitle = () => {
    const project = useSelector(useCurrentProject);
    const [currentTitle, setCurrentTitle] = useState(project?.title);
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

    useEffect(() => {
        if (!editMode) {
            setCurrentTitle(project?.title);
        }
    }, [editMode]);

    useEffect(() => {
        if (!project?.title) {
            return;
        }

        setCurrentTitle(project?.title);
    }, [project?.title]);

    const onInputBlur = useCallback(async () => {
        if (!project?.projectId || !currentTitle) {
            return;
        }
        dispatch(
            onProjectTitleChangedRequest({
                projectId: project.projectId,
                title: currentTitle,
                okCallback: () => {
                    setCurrentTitle(currentTitle);
                    setEditMode(false);
                },
                failCallback: () => {
                    setCurrentTitle(project.title);
                    setEditMode(false);
                },
            })
        );
    }, [project, currentTitle, dispatch]);

    const onPressPencil = () => {
        if (editMode) {
            return;
        }
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
        <div className="change-title-container">
            <input
                ref={inputRef as never}
                value={currentTitle}
                onChange={
                    editMode
                        ? (e) => setCurrentTitle(e.target.value)
                        : undefined
                }
                onBlur={editMode ? onInputBlur : undefined}
                onKeyDown={editMode ? onKeyDown : undefined}
                disabled={!editMode}
                className={`${classNames('change-title-input', { disabled: !editMode })}`}
            />
            {!projectIsReadonly && (
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
