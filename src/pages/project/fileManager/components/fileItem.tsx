import { useDispatch, useSelector } from 'react-redux';
import { Ref, useEffect, useRef, useState } from 'react';
import classNames from 'classnames';

import { Typography } from '../../../../componenets/typography';
import { DropdownMenu } from '../../../../shared/components/dropdownMenu';
import { FileIcon, PencilIcon, PlusIcon } from '../../../../shared/icons';
import { colors } from '../../../../shared/styles/colors';
import { IFile } from '../models/file';

import './file-item.style.scss';
import { useDictionary } from '../../../../store/selectors/translations';
import { useCurrentProject } from '../../../../store/selectors/program';
import { StorageState } from '../../../../store';
import { setEditModeForFilename } from '../../../../store/slices/settings';
import { deleteFileRequest } from '../../../../rpi/files.tsx';
import { renameFileRequest } from '../../../../rpi/project.tsx';
import { logoutAction } from '../../../../store/actions';
import { toast } from 'react-toastify';

export const FileItem = (props: {
    file: IFile;
    onAfterSuccessChange?: () => unknown;
    showDropDown: boolean;
}) => {
    const dictionary = useSelector(useDictionary);

    const [editMode, setEditItem] = useState(false);
    const [fileName, setFileName] = useState(props.file.fileName);
    const [showDropdown, setShowDropdown] = useState(true);
    const globalEditFileMode = useSelector(
        (state: StorageState) => state.settings.editModeForFilename
    );
    const inputRef = useRef<HTMLInputElement>(null);
    const project = useSelector(useCurrentProject);
    const dispatch = useDispatch();

    useEffect(() => {
        if (!globalEditFileMode && editMode) {
            onBlurInput().finally(() => {
                if (window.getSelection) {
                    window.getSelection()?.removeAllRanges();
                }
                setEditItem(false);
            });
        }
    }, [globalEditFileMode]);

    const onDeleteFile = async () => {
        if (!project?.projectId) {
            return;
        }
        const result = await deleteFileRequest(
            props.file.fileName,
            project?.projectId?.toString()
        );
        if (result.isUnauth) {
            toast(dictionary.filemanager.errors.sessionExpired, {
                type: 'error',
            });
            dispatch(logoutAction);
        }
        if (result.isOk) {
            await props.onAfterSuccessChange?.();
        }
    };

    const onPressChangeButton = async () => {
        setEditItem(true);
        dispatch(setEditModeForFilename(true));

        setTimeout(() => {
            setShowDropdown(false);
            inputRef?.current?.select();
            setTimeout(() => {
                setShowDropdown(true);
            }, 10);
        }, 200);
    };

    const onBlurInput = async () => {
        if (!project?.projectId) {
            dispatch(setEditModeForFilename(false));
            return;
        }
        if (props.file.fileName === fileName) {
            dispatch(setEditModeForFilename(false));
            return;
        }
        if (!fileName) {
            dispatch(setEditModeForFilename(false));
            setFileName(props.file.fileName);
            return;
        }

        const result = await renameFileRequest(
            props.file.fileName,
            fileName,
            project?.projectId?.toString()
        );
        if (result.isUnauth) {
            toast(dictionary.filemanager.errors.sessionExpired, {
                type: 'error',
            });
            dispatch(logoutAction);
        }
        if (result.isForbidden) {
            // TODO show toast here
        }
        if (result.isOk) {
            await props.onAfterSuccessChange?.();
        }
        dispatch(setEditModeForFilename(false));
    };

    const onChange = (value) => {
        setFileName(value);
    };

    return (
        <div className="file-item ">
            <FileIcon />
            <div
                className={classNames({ 'hoverable-item': !editMode })}
                onClick={
                    !editMode
                        ? () => window.open(props.file.url, '_blank')
                        : undefined
                }
            >
                <input
                    ref={inputRef as Ref<HTMLInputElement>}
                    value={fileName}
                    onChange={
                        editMode ? (e) => onChange(e.target.value) : undefined
                    }
                    onBlur={editMode ? onBlurInput : undefined}
                    onKeyDown={(e) =>
                        e.key === 'Enter' ? onBlurInput() : () => {}
                    }
                    disabled={!editMode}
                    className={`${classNames('change-filename-input', { disabled: !editMode })}`}
                    style={{ pointerEvents: !editMode ? 'none' : 'auto' }} // Добавьте этот стиль
                />
            </div>
            {props.showDropDown ? (
                <DropdownMenu>
                    {showDropdown ? (
                        <>
                            <div
                                onClick={onDeleteFile}
                                className="delete-file-container"
                            >
                                <div className="delete-icon">
                                    <PlusIcon />
                                </div>
                                <Typography
                                    color={colors.gray10}
                                    text={dictionary.delete}
                                />
                            </div>
                            <div
                                onClick={onPressChangeButton}
                                className="edit-file-container"
                            >
                                <div className="edit-icon">
                                    <PencilIcon />
                                </div>
                                <Typography
                                    color={colors.gray10}
                                    text={dictionary.filemanager.edit}
                                />
                            </div>
                        </>
                    ) : null}
                </DropdownMenu>
            ) : (
                <div style={{ width: 28 }} />
            )}
        </div>
    );
};
