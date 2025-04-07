import { useCallback, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import './style.scss';
import { IdeHeader } from './header';
import { AddBlock } from './addBlock';
import { Segments } from './segments';
import { Button } from '../../../../componenets/button';
import { RightArrowIcon } from '../../../../shared/icons';
import {
    useCurrentProgram,
    useCurrentProjectId,
    useUser,
} from '../../../../store/selectors/program';
import { compileProject } from '../../../../store/thunk';
import classNames from 'classnames';
import { InterfaceTourAnchorClassnames } from '../../../../shared/components/tour/helpers';

import { useDictionary } from '../../../../store/selectors/translations';
import { setUpdateFiles } from '../../../../store/slices/ide';
import { StorageState } from '../../../../store';
import { saveProgramRequest } from '../../../../rpi/project.tsx';
import { logoutAction } from '../../../../store/actions';
import { toast } from 'react-toastify';
import { UnknownAction } from '@reduxjs/toolkit';

export const Ide = () => {
    const [isLoading, setIsLoading] = useState(false);
    const isAutocomleteLoading = useSelector(
        (state: StorageState) => state.settings.isAutompleteLoading
    );
    const program = useSelector(useCurrentProgram);
    const user = useSelector(useUser);
    const projectId = useSelector(useCurrentProjectId);
    const dictionary = useSelector(useDictionary);
    const isReadonly = useSelector(
        (state: StorageState) => state.project.projectIsReadonly
    );
    const dispatch = useDispatch();
    const onClickRun = useCallback(async () => {
        if (program) {
            try {
                setIsLoading(true);
                if (
                    user.isAuthenticated &&
                    projectId &&
                    !isNaN(+projectId) &&
                    !isReadonly
                ) {
                    const result = await saveProgramRequest(
                        projectId.toString(),
                        program
                    );
                    if (result.isUnauth || result.isForbidden) {
                        toast(dictionary.filemanager.errors.sessionExpired, {
                            type: 'error',
                        });
                        dispatch(logoutAction);
                    }
                    if (!result.isOk) {
                        return;
                    }
                }
                await dispatch(compileProject() as never as UnknownAction);
                if (user.isAuthenticated) {
                    dispatch(setUpdateFiles(true));
                }
            } finally {
                setTimeout(() => setIsLoading(false), 1000);
            }
        }
    }, [dispatch, program, projectId, user.isAuthenticated]);
    const isLoadingGlobal = useMemo(() => {
        return isAutocomleteLoading || isLoading;
    }, [isLoading, isAutocomleteLoading]);

    const buttonTitle = useMemo(() => {
        if (isLoadingGlobal) {
            return `${dictionary.loading}...`;
        }
        return program?.segments.length
            ? dictionary.run
            : dictionary.label_add_code;
    }, [program?.segments.length, isLoadingGlobal, dictionary.loading]);

    //useHotkeys('ctrl+enter',async () => await  dispatch(compileProject() as any), {enableOnFormTags: true, enableOnContentEditable: true});

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
                    title={buttonTitle}
                    onPress={onClickRun}
                    disabled={!program?.segments.length || isLoadingGlobal}
                    titleIcon={RightArrowIcon}
                    color="green"
                    minimize={false}
                />
            </div>
        </div>
    );
};
