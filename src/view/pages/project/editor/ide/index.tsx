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
} from '../../../../../viewModel/store/selectors/program';
import classNames from 'classnames';
import { InterfaceTourAnchorClassnames } from '../../../../components/tour/helpers';

import { AppDispatch, StorageState } from '../../../../../viewModel/store';
import { onRunButtonPressed } from '../../../../../controller';
import { useMemo, useState } from 'react';
import { useDictionary } from '../../../../../viewModel/store/selectors/translations.ts';

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

    return (
        <div className="ide-container">
            <IdeHeader />

            <div
                className={classNames('ide-flexibility-conainer', {
                    [InterfaceTourAnchorClassnames.Ide]: true,
                })}
            >
                {!program?.segments.length && !isReadonly ? (
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
                        dispatch(onRunButtonPressed());
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
