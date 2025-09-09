import { useDispatch, useSelector } from 'react-redux';
import './style.scss';
import { IdeHeader } from './header';
import { AddBlock } from './addBlock';
import { Segments } from './segments';
import { Button } from '../../../../components/button';
import { RightArrowIcon } from '../../../../icons';
import {
    useCurrentProgram,
    useIsProjectReadonly,
} from '../../../../store/selectors/program';
import classNames from 'classnames';
import { InterfaceTourAnchorClassnames } from '../../../../components/tour/helpers';

import { AppDispatch, StorageState } from '../../../../store';
import { useEffect, useMemo, useState } from 'react';
import { useDictionary } from '../../../../store/selectors/translations.ts';
import { controller } from '../../../../../main.tsx';

export const Ide = () => {
    const dispatch = useDispatch<AppDispatch>();
    const [flag, setFlag] = useState(false);

    /*
    STATE
     */
    const isAutocompleteLoading = useSelector(
        (state: StorageState) => state.settings.isCompiling
    );
    const program = useSelector(useCurrentProgram);
    const isReadonly = useSelector(useIsProjectReadonly);
    const dictionary = useSelector(useDictionary);
    const getProjectRequestState = useSelector(
        (state: StorageState) => state.ide.getProjectRequestState
    );

    const disabled = useMemo(
        () =>
            !program.segments.length ||
            isAutocompleteLoading ||
            !program.segments.find((s) => s.type === 'computational') ||
            flag,
        [flag, isAutocompleteLoading, program.segments]
    );

    const title = useMemo(() => {
        if (isAutocompleteLoading || flag) {
            return `${dictionary.loading}...`;
        }
        if (!program.segments.length) {
            return dictionary.add_segment;
        }
        return !disabled ? dictionary.run : dictionary.no_comp_segment;
    }, [
        isAutocompleteLoading,
        flag,
        program.segments.length,
        disabled,
        dictionary,
    ]);

    /*
    Горячая клавиша для запуска программы
     */
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const isModifierPressed = event.ctrlKey || event.metaKey;
            const isSpace = event.code === 'Space' || event.key === ' ';
            if (!isModifierPressed || !isSpace) return;

            // Предотвращаем стандартное действие (прокрутка/спотлайт в браузере, если возможно)
            event.preventDefault();

            if (disabled) return;

            setFlag(true);
            setTimeout(() => {
                setFlag(false);
            }, 1000);
            dispatch(controller.onRunButtonPressedRequest());
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [dispatch, disabled]);

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
                <Button
                    classname="run-button"
                    title={title}
                    onPress={() => {
                        setFlag(true);
                        setTimeout(() => {
                            setFlag(false);
                        }, 1000);
                        dispatch(controller.onRunButtonPressedRequest());
                    }}
                    disabled={disabled}
                    titleIcon={() =>
                        disabled ? undefined : <RightArrowIcon />
                    }
                    color="green"
                    minimize={false}
                />
            </div>
        </div>
    );
};
