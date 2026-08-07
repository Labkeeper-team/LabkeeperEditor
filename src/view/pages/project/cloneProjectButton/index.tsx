import { useDispatch, useSelector } from 'react-redux';
import { Button } from '../../../components/button';
import { Typography } from '../../../components/typography';
import { AppDispatch, StorageState } from '../../../store';
import { useDictionary } from '../../../store/selectors/translations';
import {
    useCurrentProject,
    useIsProjectReadonly,
} from '../../../store/selectors/program';
import { controller } from '../../../../main.tsx';
import './style.scss';

export const CloneProjectButton = () => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const isReadonly = useSelector(useIsProjectReadonly);
    const project = useSelector(useCurrentProject);
    const cloneRequestState = useSelector(
        (state: StorageState) => state.ide.cloneRequestState
    );

    if (!isReadonly || !project?.isPublic) {
        return null;
    }

    const isCloneLoading = cloneRequestState === 'loading';
    const isCloneError = cloneRequestState === 'error';

    return (
        <div className="clone-project-panel">
            <div className="clone-project-panel__badge">
                <Typography
                    type="label-small"
                    text={dictionary.readonly_public_project}
                />
            </div>
            <Button
                title={dictionary.clone}
                rounded
                minimize
                color="green"
                disabled={isCloneLoading}
                titleIcon={
                    isCloneLoading
                        ? () => (
                              <span className="clone-project-panel__spinner" />
                          )
                        : isCloneError
                          ? () => (
                                <span className="clone-project-panel__error" />
                            )
                          : undefined
                }
                onPress={() => dispatch(controller.onCloneProjectRequest())}
            />
        </div>
    );
};
