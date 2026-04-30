import { Instruction } from './instruction';
import { Result } from './result';
import './style.scss';
import { useDispatch, useSelector } from 'react-redux';
import { Select } from '../../../components/select';
import { SelectClassNames } from '../../../components/select/model';
import { AppDispatch, StorageState } from '../../../store';
import { controller } from '../../../../main.tsx';
import { useDictionary } from '../../../store/selectors/translations';
import '../editor/ide/header/settingsButtons/markdownType/style.scss';
import { ProjectType } from '../../../../model/domain.ts';
import { useIsProjectReadonly } from '../../../store/selectors/program.ts';
import { Button } from '../../../components/button';
import { PromptModal } from './promptModal';
import { SparkleIcon } from '../../../icons';

export const Viewer = () => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const isReadonly = useSelector(useIsProjectReadonly);
    const options = [
        { label: dictionary.viewer.mode.markdown, value: 'markdown' },
        { label: dictionary.viewer.mode.latex, value: 'latex' },
    ];
    const mode = useSelector((state: StorageState) => state.project.mode);

    return (
        <div className="viewer-container">
            <div className="viewer-header">
                <div
                    className="ide-wrapper"
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                >
                    <Select
                        options={options}
                        value={mode}
                        onChange={(val) =>
                            dispatch(
                                controller.onProjectModeChangeRequest({
                                    type: val as ProjectType,
                                })
                            )
                        }
                        className={SelectClassNames.Default}
                        minimize
                    />
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
                <div />
            </div>
            <Result mode={mode} />
            <Instruction />
            <PromptModal />
        </div>
    );
};
