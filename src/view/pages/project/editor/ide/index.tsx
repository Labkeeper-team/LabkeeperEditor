import { useSelector } from 'react-redux';
import './style.scss';
import { IdeHeader } from './header';
import { AddBlock } from './addBlock';
import { Segments } from './segments';
import {
    useCurrentProgram,
    useIsProjectReadonly,
} from '../../../../store/selectors/program';
import classNames from 'classnames';
import { InterfaceTourAnchorClassnames } from '../../../../components/tour/helpers';

import { StorageState } from '../../../../store';
import { useDictionary } from '../../../../store/selectors/translations.ts';
import { RunButton } from '../runButton';

export const Ide = () => {
    /*
    STATE
     */
    const program = useSelector(useCurrentProgram);
    const isReadonly = useSelector(useIsProjectReadonly);
    const dictionary = useSelector(useDictionary);
    const getProjectRequestState = useSelector(
        (state: StorageState) => state.ide.getProjectRequestState
    );

    return (
        <div className="ide-container">
            <IdeHeader />

            <div
                className={classNames('ide-flexibility-container', {
                    [InterfaceTourAnchorClassnames.Ide]: true,
                })}
            >
                {getProjectRequestState === 'loading' ? (
                    <div className="ide-loading-wrapper" aria-hidden>
                        <span className="ide-loading-spinner" />
                    </div>
                ) : getProjectRequestState !== 'ok' &&
                  getProjectRequestState !== 'unknown' ? (
                    <div className="ide-loading-wrapper" aria-hidden>
                        <div className="ide-loading-icon-with-text">
                            <span className="ide-loading-warning" />
                            <div className="ide-loading-caption">
                                {(() => {
                                    switch (getProjectRequestState) {
                                        case 'forbidden':
                                            return dictionary.filemanager.errors
                                                .notEnoughRights;
                                        case 'not_found':
                                            return dictionary.filemanager.errors
                                                .notFound;
                                        default:
                                            return dictionary.filemanager.errors
                                                .internalError;
                                    }
                                })()}
                            </div>
                        </div>
                    </div>
                ) : !program?.segments.length && !isReadonly ? (
                    <AddBlock isFirst />
                ) : (
                    <Segments />
                )}
                <RunButton enableHotkey />
            </div>
        </div>
    );
};
