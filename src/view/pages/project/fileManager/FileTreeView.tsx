import {
    ChangeEvent,
    DragEvent,
    LegacyRef,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';
import { FileIcon, FolderIcon, PencilIcon, PlusIcon } from '../../../icons';
import { Typography } from '../../../components/typography';
import { DropdownMenu } from '../../../components/dropdownMenu';
import { colors } from '../../../styles/colors';
import { useDictionary } from '../../../store/selectors/translations';
import { AppDispatch, StorageState } from '../../../store';
import { controller } from '../../../../main.tsx';
import { useIsMobile } from '../../../hooks/useMobile';
import {
    buildFileTree,
    FileTreeNode,
    isImageFilePath,
    isTextFilePath,
    normalizeFileTreeNodeName,
} from './svarFileTreeAdapter.ts';
import { LabkeeperFile } from '../../../../model/domain.ts';
import { projectFilePathsMatch } from '../../../../viewModel/utils/projectFilePath.ts';
import {
    fileHunkEntryForPath,
    type FileHunkEntry,
} from '../../../../viewModel/utils/hunkGrouping.ts';
import { setMobileView } from '../../../store/slices/settings';

const SystemFileRow = (props: { file: LabkeeperFile }) => {
    const slashIndex = props.file.fileName.lastIndexOf('/');
    const name =
        slashIndex >= 0
            ? props.file.fileName.slice(slashIndex + 1)
            : props.file.fileName;

    return (
        <div
            className="tree-row tree-row-file tree-row-readonly"
            onClick={() => window.open(props.file.url, '_blank')}
        >
            <span className="tree-toggle-placeholder" />
            <FileIcon className="tree-file-icon" />
            <div className="tree-row-label">{name}</div>
            <span className="tree-menu-spacer" />
        </div>
    );
};

const CreatingFolderRow = (props: {
    name: string;
    placeholder: string;
    onChange: (name: string) => void;
    onSubmit: () => void;
    onCancel: () => void;
}) => (
    <div className="tree-row tree-row-folder tree-row-creating">
        <span className="tree-toggle">•</span>
        <FolderIcon className="tree-folder-icon" />
        <div className="tree-row-label">
            <input
                autoFocus
                value={props.name}
                placeholder={props.placeholder}
                onChange={(event) => props.onChange(event.target.value)}
                onBlur={props.onSubmit}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        event.currentTarget.blur();
                    }
                    if (event.key === 'Escape') {
                        event.preventDefault();
                        props.onCancel();
                    }
                }}
            />
        </div>
        <span className="tree-menu-spacer" />
    </div>
);

const TreeNodeRow = (props: {
    node: FileTreeNode;
    expandedPaths: Set<string>;
    selectedPath: string;
    dropTargetPath: string | null;
    isDragged: boolean;
    readonly: boolean;
    creatingFolderIn: string | null;
    creatingFolderName: string;
    creatingFolderPlaceholder: string;
    onCreatingFolderNameChange: (name: string) => void;
    onSubmitCreateFolder: () => void;
    onCancelCreateFolder: () => void;
    onToggleFolder: (path: string) => void;
    onSelectFolder: (path: string) => void;
    onOpenFile: (file: LabkeeperFile) => void;
    onDropTargetEnter: (path: string) => void;
    onExpandFolderOnDrag: (path: string) => void;
    onUploadDrop: (path: string, files: FileList) => void;
    onRenamingChange: (path: string | null) => void;
    filesWithHunks: Set<string>;
    fileHunkEntries: FileHunkEntry[];
    pendingHunkIds: string[];
    isAuthenticated: boolean;
}) => {
    const dictionary = useSelector(useDictionary);
    const dispatch = useDispatch<AppDispatch>();
    const [editMode, setEditMode] = useState(false);
    const [editName, setEditName] = useState(props.node.name);

    const isFolder = props.node.type === 'folder';
    const isExpanded = isFolder && props.expandedPaths.has(props.node.path);
    const isSelected =
        isFolder && props.selectedPath === props.node.path && !props.isDragged;
    const isDropTarget =
        props.isDragged && isFolder && props.dropTargetPath === props.node.path;
    const hasHunks =
        !isFolder &&
        [...props.filesWithHunks].some((fileName) =>
            projectFilePathsMatch(fileName, props.node.path)
        );
    const fileHunkEntry = !isFolder
        ? fileHunkEntryForPath(props.fileHunkEntries, props.node.path)
        : undefined;
    const hunkPending =
        fileHunkEntry?.hunkIds.some((id) =>
            props.pendingHunkIds.includes(id)
        ) ?? false;

    const handleDragOver = useCallback(
        (event: DragEvent<HTMLElement>) => {
            if (!props.isDragged || props.readonly || !isFolder) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            props.onExpandFolderOnDrag(props.node.path);
            props.onDropTargetEnter(props.node.path);
        },
        [isFolder, props]
    );

    const handleDrop = useCallback(
        (event: DragEvent<HTMLElement>) => {
            if (!props.isDragged || props.readonly || !isFolder) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            // TODO(3) move file → folder (internal tree drag):
            // UI: dataTransfer с 'application/x-labkeeper-file-path', флаг isInternalTreeDrag.
            // A) без folder API: onMoveFileRequest → onSvarMoveFiles → renameFileRequest на каждый файл.
            // B) с folder API: onMoveFileRequest → rpi.moveFileRequest(oldPath, targetFolder, projectId).
            // Сейчас drop принимает только файлы с диска (dataTransfer.files).
            if (event.dataTransfer.files.length) {
                props.onUploadDrop(props.node.path, event.dataTransfer.files);
            }
        },
        [isFolder, props]
    );

    const onClickRow = useCallback(() => {
        if (editMode) {
            return;
        }
        if (isFolder) {
            props.onToggleFolder(props.node.path);
            props.onSelectFolder(props.node.path);
            return;
        }
        if (props.node.file || props.node.isHunkPhantom) {
            props.onOpenFile(props.node);
        }
    }, [editMode, isFolder, props]);

    const onRename = useCallback(() => {
        if (!isFolder && !props.node.file) {
            return;
        }
        setEditMode(true);
        setEditName(props.node.name);
        props.onRenamingChange(props.node.path);
    }, [isFolder, props]);

    const cancelRename = useCallback(() => {
        setEditMode(false);
        setEditName(props.node.name);
        props.onRenamingChange(null);
    }, [props]);

    const submitRename = useCallback(() => {
        if (isFolder) {
            if (!editName.trim()) {
                cancelRename();
                return;
            }
            const normalized = normalizeFileTreeNodeName(editName);
            if (normalized === props.node.name) {
                cancelRename();
                return;
            }
            const parentPath = props.node.path.includes('/')
                ? props.node.path.slice(0, props.node.path.lastIndexOf('/'))
                : '';
            const newPath = parentPath ? `${parentPath}/${editName}` : editName;
            dispatch(
                controller.onRenameFolderRequest({
                    oldPath: props.node.path,
                    newPath,
                })
            );
            setEditMode(false);
            props.onRenamingChange(null);
            return;
        }
        if (!props.node.file || !editName.trim()) {
            cancelRename();
            return;
        }
        const parentPath = props.node.path.includes('/')
            ? props.node.path.slice(0, props.node.path.lastIndexOf('/'))
            : '';
        const newPath = parentPath ? `${parentPath}/${editName}` : editName;
        dispatch(
            controller.onFileNameChangedRequest({
                oldName: props.node.path,
                newName: newPath,
            })
        );
        setEditMode(false);
        props.onRenamingChange(null);
    }, [cancelRename, dispatch, editName, isFolder, props]);

    return (
        <>
            {isFolder ? (
                <div
                    className={classNames('tree-folder-drop-zone', {
                        'tree-folder-drop-zone-active': isDropTarget,
                    })}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                    <div
                        className={classNames('tree-row', {
                            'tree-row-folder': true,
                            'tree-row-selected': isSelected,
                        })}
                        onClick={editMode ? undefined : onClickRow}
                    >
                        <button
                            type="button"
                            className="tree-toggle"
                            onClick={(event) => {
                                event.stopPropagation();
                                props.onToggleFolder(props.node.path);
                            }}
                        >
                            {props.node.children.length
                                ? isExpanded
                                    ? '▾'
                                    : '▸'
                                : '•'}
                        </button>
                        <FolderIcon className="tree-folder-icon" />
                        <div
                            className={classNames('tree-row-label', {
                                'tree-row-label-editing': editMode,
                            })}
                        >
                            {editMode ? (
                                <input
                                    autoFocus
                                    value={editName}
                                    onChange={(event) =>
                                        setEditName(event.target.value)
                                    }
                                    onBlur={submitRename}
                                    onClick={(event) => event.stopPropagation()}
                                    onMouseDown={(event) =>
                                        event.stopPropagation()
                                    }
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault();
                                            event.currentTarget.blur();
                                        }
                                        if (event.key === 'Escape') {
                                            event.preventDefault();
                                            cancelRename();
                                        }
                                    }}
                                />
                            ) : (
                                props.node.name
                            )}
                        </div>
                        {!props.readonly && !editMode ? (
                            <div
                                className="tree-row-actions"
                                onClick={(event) => event.stopPropagation()}
                            >
                                <button
                                    type="button"
                                    className="tree-row-action-button"
                                    title={dictionary.filemanager.edit}
                                    aria-label={dictionary.filemanager.edit}
                                    onClick={onRename}
                                >
                                    <PencilIcon />
                                </button>
                                <button
                                    type="button"
                                    className="tree-row-action-button tree-row-action-delete"
                                    title={dictionary.delete}
                                    aria-label={dictionary.delete}
                                    onClick={() =>
                                        dispatch(
                                            controller.onDeleteFolderRequest({
                                                path: props.node.path,
                                            })
                                        )
                                    }
                                >
                                    <div className="tree-delete-icon">
                                        <PlusIcon />
                                    </div>
                                </button>
                            </div>
                        ) : (
                            <span className="tree-menu-spacer" />
                        )}
                    </div>
                    {isExpanded ? (
                        <div
                            className={classNames('tree-children', {
                                'tree-children-fill':
                                    isDropTarget &&
                                    props.selectedPath === props.node.path,
                            })}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                        >
                            {props.node.children.map((child) => (
                                <TreeNodeRow
                                    key={`${child.type}:${child.path}`}
                                    node={child}
                                    expandedPaths={props.expandedPaths}
                                    selectedPath={props.selectedPath}
                                    dropTargetPath={props.dropTargetPath}
                                    isDragged={props.isDragged}
                                    readonly={props.readonly}
                                    creatingFolderIn={props.creatingFolderIn}
                                    creatingFolderName={
                                        props.creatingFolderName
                                    }
                                    creatingFolderPlaceholder={
                                        props.creatingFolderPlaceholder
                                    }
                                    onCreatingFolderNameChange={
                                        props.onCreatingFolderNameChange
                                    }
                                    onSubmitCreateFolder={
                                        props.onSubmitCreateFolder
                                    }
                                    onCancelCreateFolder={
                                        props.onCancelCreateFolder
                                    }
                                    onToggleFolder={props.onToggleFolder}
                                    onSelectFolder={props.onSelectFolder}
                                    onOpenFile={props.onOpenFile}
                                    onDropTargetEnter={props.onDropTargetEnter}
                                    onExpandFolderOnDrag={
                                        props.onExpandFolderOnDrag
                                    }
                                    onUploadDrop={props.onUploadDrop}
                                    onRenamingChange={props.onRenamingChange}
                                    filesWithHunks={props.filesWithHunks}
                                    fileHunkEntries={props.fileHunkEntries}
                                    pendingHunkIds={props.pendingHunkIds}
                                    isAuthenticated={props.isAuthenticated}
                                />
                            ))}
                            {props.creatingFolderIn === props.node.path ? (
                                <CreatingFolderRow
                                    name={props.creatingFolderName}
                                    placeholder={
                                        props.creatingFolderPlaceholder
                                    }
                                    onChange={props.onCreatingFolderNameChange}
                                    onSubmit={props.onSubmitCreateFolder}
                                    onCancel={props.onCancelCreateFolder}
                                />
                            ) : null}
                        </div>
                    ) : null}
                </div>
            ) : (
                <div className="tree-file-hunk-wrap">
                    <div
                        className={classNames('tree-row tree-row-file', {
                            'tree-row-file--has-hunks': hasHunks,
                            'tree-row-file--hunk-added':
                                fileHunkEntry?.state === 'added',
                            'tree-row-file--hunk-deleted':
                                fileHunkEntry?.state === 'deleted',
                            'tree-row-file--hunk-modified':
                                fileHunkEntry?.state === 'modified',
                        })}
                        onClick={editMode ? undefined : onClickRow}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                    >
                        <span className="tree-toggle-placeholder" />
                        <FileIcon className="tree-file-icon" />
                        <div
                            className={classNames('tree-row-label', {
                                'tree-row-label-editing': editMode,
                            })}
                        >
                            {editMode ? (
                                <input
                                    autoFocus
                                    value={editName}
                                    onChange={(event) =>
                                        setEditName(event.target.value)
                                    }
                                    onBlur={submitRename}
                                    onClick={(event) =>
                                        event.stopPropagation()
                                    }
                                    onMouseDown={(event) =>
                                        event.stopPropagation()
                                    }
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault();
                                            event.currentTarget.blur();
                                        }
                                        if (event.key === 'Escape') {
                                            event.preventDefault();
                                            cancelRename();
                                        }
                                    }}
                                />
                            ) : (
                                props.node.name
                            )}
                        </div>
                        {!props.readonly &&
                        !editMode &&
                        !fileHunkEntry &&
                        props.node.file ? (
                            <div onClick={(event) => event.stopPropagation()}>
                                <DropdownMenu fullScreenOnMobile>
                                    <div
                                        className="tree-menu-item tree-menu-item-delete"
                                        onClick={() =>
                                            dispatch(
                                                controller.onDeleteFileRequest(
                                                    {
                                                        fileName:
                                                            props.node.path,
                                                    }
                                                )
                                            )
                                        }
                                    >
                                        <div className="tree-delete-icon">
                                            <PlusIcon />
                                        </div>
                                        <Typography
                                            color={colors.gray10}
                                            text={dictionary.delete}
                                        />
                                    </div>
                                    <div
                                        className="tree-menu-item"
                                        onClick={onRename}
                                    >
                                        <PencilIcon />
                                        <Typography
                                            color={colors.gray10}
                                            text={
                                                dictionary.filemanager.edit
                                            }
                                        />
                                    </div>
                                </DropdownMenu>
                            </div>
                        ) : (
                            <span className="tree-menu-spacer" />
                        )}
                    </div>
                    {fileHunkEntry && !props.readonly ? (
                        <div className="tree-row-hunk-actions">
                            <button
                                type="button"
                                className="tree-hunk-btn tree-hunk-btn--accept"
                                disabled={hunkPending}
                                onClick={() =>
                                    dispatch(
                                        controller.onHunkAcceptRequest({
                                            hunkIds: fileHunkEntry.hunkIds,
                                        })
                                    )
                                }
                            >
                                {hunkPending ? (
                                    <span className="tree-hunk-btn__spinner tree-hunk-btn__spinner--accept" />
                                ) : (
                                    dictionary.hunks.accept
                                )}
                            </button>
                            {props.isAuthenticated ? (
                                <button
                                    type="button"
                                    className="tree-hunk-btn tree-hunk-btn--revert"
                                    disabled={hunkPending}
                                    onClick={() =>
                                        dispatch(
                                            controller.onHunkRevertRequest({
                                                hunkIds: fileHunkEntry.hunkIds,
                                            })
                                        )
                                    }
                                >
                                    {hunkPending ? (
                                        <span className="tree-hunk-btn__spinner tree-hunk-btn__spinner--revert" />
                                    ) : (
                                        dictionary.hunks.revert
                                    )}
                                </button>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            )}
        </>
    );
};

export const FileTreeView = (props: {
    files: LabkeeperFile[];
    systemFiles: LabkeeperFile[];
    ephemeralFolders: string[];
    readonly: boolean;
    isDragged: boolean;
    filesWithHunks: Set<string>;
    fileHunkEntries: FileHunkEntry[];
    phantomFileNames: string[];
}) => {
    const dispatch = useDispatch<AppDispatch>();
    const isMobile = useIsMobile();
    const dictionary = useSelector(useDictionary);
    const isAuthenticated = useSelector(
        (state: StorageState) => state.user.isAuthenticated
    );
    const pendingHunkIds = useSelector(
        (state: StorageState) => state.ide.pendingHunkIds
    );
    const inputRef = useRef<HTMLInputElement>(null);
    const currentFolderPath = useSelector(
        (state: StorageState) => state.settings.currentFolderPath
    );
    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
        () => new Set([''])
    );
    const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);
    const [creatingFolderIn, setCreatingFolderIn] = useState<string | null>(
        null
    );
    const [creatingFolderName, setCreatingFolderName] = useState('');
    const [renamingFilePath, setRenamingFilePath] = useState<string | null>(
        null
    );
    const dragExpandTimersRef = useRef<Map<string, number>>(new Map());

    const clearDragExpandTimers = useCallback(() => {
        dragExpandTimersRef.current.forEach((timerId) => {
            window.clearTimeout(timerId);
        });
        dragExpandTimersRef.current.clear();
    }, []);

    const expandFolderPath = useCallback((path: string) => {
        setExpandedPaths((prev) => {
            const next = new Set(prev);
            next.add('');
            if (path) {
                const parts = path.split('/');
                let current = '';
                for (const part of parts) {
                    current = current ? `${current}/${part}` : part;
                    next.add(current);
                }
            }
            if (
                next.size === prev.size &&
                [...next].every((item) => prev.has(item))
            ) {
                return prev;
            }
            return next;
        });
    }, []);

    const onSelectFile = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            if (event.target.files?.length) {
                dispatch(
                    controller.onUploadFilesRequest({
                        files: Array.from(event.target.files),
                        folderPrefix: currentFolderPath || undefined,
                    })
                );
                event.target.value = '';
            }
        },
        [currentFolderPath, dispatch]
    );

    const onAddFile = useCallback(() => {
        inputRef.current?.click();
    }, []);

    const tree = useMemo(
        () =>
            buildFileTree(
                props.files,
                props.ephemeralFolders,
                props.phantomFileNames
            ),
        [props.files, props.ephemeralFolders, props.phantomFileNames]
    );

    const activeDropTargetPath = props.isDragged ? dropTargetPath : null;

    useEffect(() => {
        if (!props.isDragged) {
            clearDragExpandTimers();
        }
    }, [clearDragExpandTimers, props.isDragged]);

    useEffect(() => clearDragExpandTimers, [clearDragExpandTimers]);

    const onToggleFolder = useCallback((path: string) => {
        setExpandedPaths((prev) => {
            const next = new Set(prev);
            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
            }
            return next;
        });
    }, []);

    const onSelectFolder = useCallback(
        (path: string) => {
            dispatch(controller.onCurrentFolderPathChangedRequest({ path }));
        },
        [dispatch]
    );

    const onDropTargetEnter = useCallback((path: string) => {
        setDropTargetPath(path);
    }, []);

    const onExpandFolderOnDrag = useCallback(
        (path: string) => {
            if (!props.isDragged || props.readonly || expandedPaths.has(path)) {
                return;
            }
            if (dragExpandTimersRef.current.has(path)) {
                return;
            }
            const timerId = window.setTimeout(() => {
                dragExpandTimersRef.current.delete(path);
                expandFolderPath(path);
            }, 400);
            dragExpandTimersRef.current.set(path, timerId);
        },
        [expandFolderPath, expandedPaths, props.isDragged, props.readonly]
    );

    const onUploadDrop = useCallback(
        (path: string, fileList: FileList) => {
            if (path === '') {
                dispatch(
                    controller.onCurrentFolderPathChangedRequest({ path: '' })
                );
            }
            dispatch(
                controller.onUploadFilesRequest({
                    files: Array.from(fileList),
                    folderPrefix: path,
                })
            );
            setDropTargetPath(null);
        },
        [dispatch]
    );

    const onOpenFile = useCallback(
        (node: FileTreeNode) => {
            const fileName = node.path;
            if (isTextFilePath(fileName)) {
                dispatch(
                    controller.onTextFileOpenedRequest({
                        fileName,
                    })
                );
                if (isMobile) {
                    dispatch(setMobileView('editor'));
                }
                return;
            }
            if (node.file && isImageFilePath(fileName)) {
                dispatch(
                    controller.onImageFileOpenedRequest({
                        fileName,
                    })
                );
                if (isMobile) {
                    dispatch(setMobileView('editor'));
                }
                return;
            }
            if (node.file?.url) {
                window.open(node.file.url, '_blank');
            }
        },
        [dispatch, isMobile]
    );

    const onCreateFile = useCallback(() => {
        dispatch(controller.onCreateFileRequest());
    }, [dispatch]);

    const expandFolderAncestors = useCallback(
        (path: string, prev: Set<string>) => {
            const next = new Set(prev);
            next.add('');
            if (!path) {
                return next;
            }
            const parts = path.split('/');
            let current = '';
            for (const part of parts) {
                current = current ? `${current}/${part}` : part;
                next.add(current);
            }
            return next;
        },
        []
    );

    const onCreateFolder = useCallback(() => {
        if (creatingFolderIn !== null) {
            return;
        }
        setCreatingFolderIn(currentFolderPath);
        setCreatingFolderName('');
        setExpandedPaths((prev) =>
            expandFolderAncestors(currentFolderPath, prev)
        );
    }, [creatingFolderIn, currentFolderPath, expandFolderAncestors]);

    const onCancelCreateFolder = useCallback(() => {
        setCreatingFolderIn(null);
        setCreatingFolderName('');
    }, []);

    const onSubmitCreateFolder = useCallback(() => {
        if (creatingFolderIn === null) {
            return;
        }
        const normalized = normalizeFileTreeNodeName(creatingFolderName);
        if (!normalized) {
            if (!creatingFolderName.trim()) {
                onCancelCreateFolder();
                return;
            }
            dispatch(
                controller.onCreateFolderRequest({
                    name: creatingFolderName,
                    parentPath: creatingFolderIn,
                })
            );
            setCreatingFolderIn(null);
            setCreatingFolderName('');
            return;
        }
        dispatch(
            controller.onCreateFolderRequest({
                name: normalized,
                parentPath: creatingFolderIn,
            })
        );
        const fullPath = creatingFolderIn
            ? `${creatingFolderIn}/${normalized}`
            : normalized;
        setExpandedPaths((prev) => expandFolderAncestors(fullPath, prev));
        dispatch(
            controller.onCurrentFolderPathChangedRequest({ path: fullPath })
        );
        setCreatingFolderIn(null);
        setCreatingFolderName('');
    }, [
        creatingFolderIn,
        creatingFolderName,
        dispatch,
        expandFolderAncestors,
        onCancelCreateFolder,
    ]);

    const rootLabel = dictionary.filemanager.your_files;

    const onRootDragOver = useCallback(
        (event: DragEvent<HTMLDivElement>) => {
            if (!props.isDragged || props.readonly) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            onDropTargetEnter('');
        },
        [onDropTargetEnter, props.isDragged, props.readonly]
    );

    const onRootDrop = useCallback(
        (event: DragEvent<HTMLDivElement>) => {
            if (!props.isDragged || props.readonly) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            if (event.dataTransfer.files.length) {
                onUploadDrop('', event.dataTransfer.files);
            }
        },
        [onUploadDrop, props.isDragged, props.readonly]
    );

    const blockSystemDrag = useCallback((event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
    }, []);

    const onUserBranchDragOver = useCallback(
        (event: DragEvent<HTMLDivElement>) => {
            if (!props.isDragged || props.readonly) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            onDropTargetEnter('');
        },
        [onDropTargetEnter, props.isDragged, props.readonly]
    );

    const onRenamingChange = useCallback((path: string | null) => {
        setRenamingFilePath(path);
    }, []);

    const toolbarDisabled =
        renamingFilePath !== null || creatingFolderIn !== null;

    const onUserBranchDragLeave = useCallback(
        (event: DragEvent<HTMLDivElement>) => {
            const related = event.relatedTarget as Node | null;
            if (!related || !event.currentTarget.contains(related)) {
                setDropTargetPath(null);
            }
        },
        []
    );

    const onUserBranchDrop = useCallback(
        (event: DragEvent<HTMLDivElement>) => {
            if (!props.isDragged || props.readonly) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            // TODO(3): internal tree drag — см. handleDrop в TreeNodeRow (варианты A/B).
            if (event.dataTransfer.files.length) {
                onUploadDrop(
                    activeDropTargetPath ?? '',
                    event.dataTransfer.files
                );
            }
        },
        [activeDropTargetPath, onUploadDrop, props.isDragged, props.readonly]
    );

    return (
        <div className="file-tree-view">
            {!props.readonly ? (
                <div className="file-tree-toolbar">
                    <input
                        onChange={onSelectFile}
                        ref={inputRef as LegacyRef<HTMLInputElement>}
                        style={{ display: 'none' }}
                        type="file"
                        accept=".png, .jpg, .jpeg, .svg, .txt, .csv, .tex, .bib, .bst"
                        multiple
                    />
                    <button
                        type="button"
                        className="file-tree-toolbar-button"
                        onClick={onAddFile}
                        disabled={toolbarDisabled}
                    >
                        + {dictionary.filemanager.add}
                    </button>
                    <button
                        type="button"
                        className="file-tree-toolbar-button"
                        onClick={onCreateFile}
                        disabled={toolbarDisabled}
                    >
                        + {dictionary.filemanager.create_file}
                    </button>
                    <button
                        type="button"
                        className="file-tree-toolbar-button"
                        onClick={onCreateFolder}
                        disabled={toolbarDisabled}
                    >
                        + {dictionary.filemanager.create_folder}
                    </button>
                </div>
            ) : null}
            <div className="file-tree-scroll">
                <div className="file-tree-user-branch">
                    <div
                        className={classNames('file-tree-root-drop-zone', {
                            'file-tree-root-drop-zone-active':
                                activeDropTargetPath === '',
                        })}
                    >
                        <div
                            className={classNames(
                                'tree-row tree-row-folder tree-root-zone',
                                {
                                    'tree-row-selected':
                                        currentFolderPath === '' &&
                                        !props.isDragged,
                                }
                            )}
                            onClick={() => onSelectFolder('')}
                            onDragOver={onRootDragOver}
                            onDrop={onRootDrop}
                        >
                            <span className="tree-toggle">▾</span>
                            <FolderIcon className="tree-folder-icon" />
                            <div className="tree-row-label">{rootLabel}</div>
                            <span className="tree-menu-spacer" />
                        </div>
                        <div
                            className="file-tree-user-scroll"
                            onDragOver={onUserBranchDragOver}
                            onDragLeave={onUserBranchDragLeave}
                            onDrop={onUserBranchDrop}
                        >
                            <div
                                className="tree-children tree-root-children"
                                onDragOver={onRootDragOver}
                                onDrop={onRootDrop}
                            >
                                {tree.length ? (
                                    tree.map((node) => (
                                        <TreeNodeRow
                                            key={`${node.type}:${node.path}`}
                                            node={node}
                                            expandedPaths={expandedPaths}
                                            selectedPath={currentFolderPath}
                                            dropTargetPath={
                                                activeDropTargetPath
                                            }
                                            isDragged={props.isDragged}
                                            readonly={props.readonly}
                                            creatingFolderIn={creatingFolderIn}
                                            creatingFolderName={
                                                creatingFolderName
                                            }
                                            creatingFolderPlaceholder={
                                                dictionary.filemanager
                                                    .create_folder
                                            }
                                            onCreatingFolderNameChange={
                                                setCreatingFolderName
                                            }
                                            onSubmitCreateFolder={
                                                onSubmitCreateFolder
                                            }
                                            onCancelCreateFolder={
                                                onCancelCreateFolder
                                            }
                                            onToggleFolder={onToggleFolder}
                                            onSelectFolder={onSelectFolder}
                                            onOpenFile={onOpenFile}
                                            onDropTargetEnter={
                                                onDropTargetEnter
                                            }
                                            onExpandFolderOnDrag={
                                                onExpandFolderOnDrag
                                            }
                                            onUploadDrop={onUploadDrop}
                                            onRenamingChange={onRenamingChange}
                                            filesWithHunks={
                                                props.filesWithHunks
                                            }
                                            fileHunkEntries={
                                                props.fileHunkEntries
                                            }
                                            pendingHunkIds={pendingHunkIds}
                                            isAuthenticated={isAuthenticated}
                                        />
                                    ))
                                ) : creatingFolderIn === '' ? null : (
                                    <div className="file-tree-empty">
                                        {dictionary.filemanager.empty}
                                    </div>
                                )}
                                {creatingFolderIn === '' ? (
                                    <CreatingFolderRow
                                        name={creatingFolderName}
                                        placeholder={
                                            dictionary.filemanager.create_folder
                                        }
                                        onChange={setCreatingFolderName}
                                        onSubmit={onSubmitCreateFolder}
                                        onCancel={onCancelCreateFolder}
                                    />
                                ) : null}
                            </div>
                            <div
                                className="file-tree-drop-fill"
                                onDragOver={onRootDragOver}
                                onDrop={onRootDrop}
                                aria-hidden
                            />
                        </div>
                    </div>
                </div>
                {props.systemFiles.length ? (
                    <div className="file-tree-system-section">
                        <div className="tree-section-divider" />
                        <div
                            className="tree-row tree-row-folder tree-system-root"
                            onDragOver={blockSystemDrag}
                            onDrop={blockSystemDrag}
                        >
                            <span className="tree-toggle">▾</span>
                            <FolderIcon className="tree-folder-icon" />
                            <div className="tree-row-label">
                                {dictionary.filemanager.system_files}
                            </div>
                            <span className="tree-menu-spacer" />
                        </div>
                        <div
                            className="tree-children tree-system-children"
                            onDragOver={blockSystemDrag}
                            onDrop={blockSystemDrag}
                        >
                            {props.systemFiles.map((file) => (
                                <SystemFileRow
                                    key={file.fileName}
                                    file={file}
                                />
                            ))}
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
};
