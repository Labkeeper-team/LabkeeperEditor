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
import { ProjectPanelSwitcher } from '../mobilePanelSwitcher';

export const Viewer = () => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const isReadonly = useSelector(useIsProjectReadonly);

    return (
        <div className="viewer-container">
            <div className="viewer-header">
                <div className="viewer-header-actions">
                    {!isReadonly && (
                        <Button
                            title={dictionary.viewer.gpt_prompt_button}
                            onPress={() =>
                                dispatch(controller.onLlmButtonClickedRequest())
                            }
                            minimize
                            rounded
                            color="gray"
                            titleIcon={() => <SparkleIcon />}
                        />
                    )}
                </div>
                <ProjectPanelSwitcher />
            </div>
            <Result />
            <Instruction />
            <PromptModal />
        </div>
    );
};
