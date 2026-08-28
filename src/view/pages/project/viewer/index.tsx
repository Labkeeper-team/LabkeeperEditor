import { Instruction } from './instruction';
import { Result } from './result';
import './style.scss';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '../../../store';
import { controller } from '../../../../main.tsx';
import { useDictionary } from '../../../store/selectors/translations';

import '../editor/ide/header/settingsButtons/markdownType/style.scss';

import { useIsProjectReadonly } from '../../../store/selectors/program.ts';
import { Button } from '../../../components/button';
import { PromptModal } from './promptModal';
import { SparkleIcon } from '../../../icons';
import { SynctexButton } from '../syncButtons';
import { useIsMobile } from '../../../hooks/useMobile';
import { CloneProjectButton } from '../cloneProjectButton';
import { StorageState } from '../../../store';

export const Viewer = () => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const isReadonly = useSelector(useIsProjectReadonly);
    const isMobile = useIsMobile();
    const promptRequestState = useSelector(
        (state: StorageState) => state.ide.projectPromptRequestState
    );
    const isPromptLoading = promptRequestState === 'loading';

    return (
        <div className="viewer-container">
            <div className="viewer-header">
                <div
                    className="ide-wrapper"
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                >
                    {!isReadonly && (
                        <Button
                            title={dictionary.viewer.gpt_prompt_button}
                            onPress={() =>
                                dispatch(controller.onLlmButtonClickedRequest())
                            }
                            minimize
                            rounded
                            color="gray"
                            disabled={isPromptLoading}
                            titleIcon={() =>
                                isPromptLoading ? (
                                    <span className="prompt-modal__spinner-inline" />
                                ) : (
                                    <SparkleIcon />
                                )
                            }
                        />
                    )}
                    {isMobile ? <SynctexButton direction="toEditor" /> : null}
                </div>
                {isReadonly && isMobile ? <CloneProjectButton /> : <div />}
            </div>
            <Result />
            <Instruction />
            <PromptModal />
        </div>
    );
};
