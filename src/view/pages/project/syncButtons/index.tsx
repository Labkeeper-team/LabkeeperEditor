import { useDispatch, useSelector } from 'react-redux';
import classNames from 'classnames';

import { RightArrowIcon } from '../../../icons';
import { AppDispatch, StorageState } from '../../../store';
import { useDictionary } from '../../../store/selectors/translations';
import {
    useCurrentProject,
    useIsProjectReadonly,
} from '../../../store/selectors/program';
import { controller } from '../../../../main.tsx';

import './style.scss';

export const SyncButtons = () => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const project = useSelector(useCurrentProject);
    const isReadonly = useSelector(useIsProjectReadonly);
    const isLatexMode = useSelector(
        (state: StorageState) => state.project.mode === 'latex'
    );
    const isAuth = useSelector(
        (state: StorageState) => state.user.isAuthenticated
    );
    const pdfUri = useSelector((state: StorageState) => state.project.pdfUri);

    const visible =
        isAuth && isLatexMode && !isReadonly && Boolean(project?.projectId);

    if (!visible) {
        return null;
    }

    return (
        <div className="project-sync-bar" aria-label="SyncTeX navigation">
            <div className="synctex-buttons">
                <button
                    type="button"
                    className={classNames('synctex-button', {
                        'synctex-button--disabled': !pdfUri,
                    })}
                    title={dictionary.synctex.to_pdf}
                    aria-label={dictionary.synctex.to_pdf}
                    disabled={!pdfUri}
                    onMouseDown={(event) => {
                        event.preventDefault();
                        dispatch(controller.onSyncEditorToPdfRequest());
                    }}
                >
                    <RightArrowIcon />
                </button>
                <button
                    type="button"
                    className={classNames(
                        'synctex-button',
                        'synctex-button--reverse',
                        {
                            'synctex-button--disabled': !pdfUri,
                        }
                    )}
                    title={dictionary.synctex.to_editor}
                    aria-label={dictionary.synctex.to_editor}
                    disabled={!pdfUri}
                    onClick={() =>
                        dispatch(controller.onSyncPdfToEditorRequest())
                    }
                >
                    <RightArrowIcon />
                </button>
            </div>
        </div>
    );
};
