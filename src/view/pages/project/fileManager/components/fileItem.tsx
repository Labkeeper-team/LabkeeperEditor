import { useDispatch, useSelector } from 'react-redux';
import { Ref, useCallback, useEffect, useRef, useState } from 'react';
import classNames from 'classnames';

import { Typography } from '../../../../components/typography';
import { DropdownMenu } from '../../../../components/dropdownMenu';
import { FileIcon, PencilIcon, PlusIcon } from '../../../../icons';
import { colors } from '../../../../styles/colors';

import './file-item.style.scss';
import { useDictionary } from '../../../../../viewModel/store/selectors/translations';
import { AppDispatch, StorageState } from '../../../../../viewModel/store';
import { LabkeeperFile } from '../../../../../model/domain.ts';
import {
    onDeleteFileRequest,
    onFileNameChangedRequest,
    onFileRenameButtonClickedRequest,
} from '../../../../../controller';

export const FileItem = (props: {
    file: LabkeeperFile;
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
    const dispatch = useDispatch<AppDispatch>();

    /*
    Когда глобальный флаг редактирования файла поменялся
     */
    useEffect(() => {
        if (!globalEditFileMode && editMode) {
            onBlurInput().finally(() => {
                if (window.getSelection) {
                    window.getSelection()?.removeAllRanges();
                }
                setEditItem(false);
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [globalEditFileMode]);

    /*
    При нажатии на кнопку переименовать
     */
    const onPressChangeButton = useCallback(async () => {
        setEditItem(true);
        dispatch(onFileRenameButtonClickedRequest());

        setTimeout(() => {
            setShowDropdown(false);
            inputRef?.current?.select();
            setTimeout(() => {
                setShowDropdown(true);
            }, 10);
        }, 200);
    }, [dispatch, inputRef]);

    /*
    Когда ввод прекратился
     */
    const onBlurInput = useCallback(async () => {
        if (!fileName) {
            setFileName(props.file.fileName);
        }
        dispatch(
            onFileNameChangedRequest({
                oldName: props.file.fileName,
                newName: fileName,
            })
        );
    }, [fileName, dispatch, props.file.fileName]);

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
                        editMode
                            ? (e) => setFileName(e.target.value)
                            : undefined
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
                                onClick={() =>
                                    dispatch(
                                        onDeleteFileRequest({
                                            fileName: props.file.fileName,
                                        })
                                    )
                                }
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
