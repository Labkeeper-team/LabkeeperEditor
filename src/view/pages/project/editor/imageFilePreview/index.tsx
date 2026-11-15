import { useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, StorageState } from '../../../../store';
import { controller } from '../../../../../main.tsx';
import { PlusIcon } from '../../../../icons';
import { selectCollabFileRevision } from '../../../../store/selectors/collab.ts';
import '../ide/style.scss';
import '../ide/header/style.scss';
import './style.scss';

/** Cache-busting query parameter for a replaced file; the URL as it is otherwise */
function withRevision(url: string, revision: number): string {
    if (!revision) {
        return url;
    }
    return `${url}${url.includes('?') ? '&' : '?'}lkrev=${revision}`;
}

export const ImageFilePreview = () => {
    const dispatch = useDispatch<AppDispatch>();
    const activeImageFile = useSelector(
        (state: StorageState) => state.ide.activeImageFile
    );
    const files = useSelector((state: StorageState) => state.project.files);
    // collaborative editing: the file was replaced by an upload, the browser must not show the old one
    const revision = useSelector(
        useMemo(
            () => selectCollabFileRevision(activeImageFile),
            [activeImageFile]
        )
    );

    const file = useMemo(
        () => files.find((item) => item.fileName === activeImageFile),
        [activeImageFile, files]
    );

    const onClose = useCallback(() => {
        dispatch(controller.onImageFilePreviewClosedRequest());
    }, [dispatch]);

    if (!activeImageFile || !file) {
        return null;
    }

    const fileLabel = activeImageFile.includes('/')
        ? activeImageFile.slice(activeImageFile.lastIndexOf('/') + 1)
        : activeImageFile;

    return (
        <div className="ide-container">
            <div className="ide-header">
                <div className="ide-wrapper">
                    <span
                        className="text-file-editor-title"
                        title={activeImageFile}
                    >
                        {fileLabel}
                    </span>
                </div>
                <div />
                <button
                    type="button"
                    className="text-file-editor-close"
                    onClick={onClose}
                    aria-label="Close"
                >
                    <PlusIcon style={{ rotate: '45deg' }} />
                </button>
            </div>
            <div className="ide-flexibility-container image-file-preview-body">
                <img
                    className="image-file-preview-image"
                    src={withRevision(file.url, revision)}
                    alt={fileLabel}
                    draggable={false}
                />
            </div>
        </div>
    );
};
