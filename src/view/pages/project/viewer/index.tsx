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

export const Viewer = () => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);

    const options = [
        { label: dictionary.viewer.mode.markdown, value: 'markdown' },
        { label: dictionary.viewer.mode.latex, value: 'latex' },
    ];
    const currentValue = useSelector(
        (state: StorageState) => state.project.mode
    );

    return (
        <div className="viewer-container">
            <div className="viewer-header">
                <div className="ide-wrapper">
                    <Select
                        options={options}
                        value={currentValue}
                        onChange={(val) =>
                            dispatch(
                                controller.onProjectModeChangeRequest({
                                    mode: val as ProjectMode,
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
            <Result />
            <Instruction />
        </div>
    );
};
