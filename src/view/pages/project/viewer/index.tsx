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
import { ProjectMode } from '../../../../model/domain.ts';
import { useCurrentProject } from '../../../store/selectors/program.ts';

export const Viewer = () => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const project = useSelector(useCurrentProject);
    const options = [
        { label: dictionary.viewer.mode.markdown, value: 'markdown' },
        { label: dictionary.viewer.mode.latex, value: 'latex' },
    ];
    const currentRunTimeValue = useSelector(
        (state: StorageState) => state.project.mode
    );

    const currentPersistValue = useSelector(
        (state: StorageState) =>
            state.persistence.projectCompileModes[
                project?.projectId || 'default'
            ]
    );

    const mode = currentPersistValue ?? currentRunTimeValue;

    return (
        <div className="viewer-container">
            <div className="viewer-header">
                <div className="ide-wrapper">
                    <Select
                        options={options}
                        value={mode}
                        onChange={(val) =>
                            dispatch(
                                controller.onProjectModeChangeRequest({
                                    mode: val as ProjectMode,
                                    projectId: project?.projectId || 'default',
                                })
                            )
                        }
                        className={SelectClassNames.Default}
                        minimize
                    />
                </div>
                <div />
                <div />
            </div>
            <Result mode={mode} />
            <Instruction />
        </div>
    );
};
