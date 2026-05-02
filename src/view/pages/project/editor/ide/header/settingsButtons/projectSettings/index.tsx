import { useDispatch, useSelector } from 'react-redux';
import {
    useCurrentProgram,
    useCurrentProject,
} from '../../../../../../../store/selectors/program';

import './style.scss';
import { Typography } from '../../../../../../../components/typography';
import { colors } from '../../../../../../../styles/colors';
import { Radio } from '../../../../../../../components/radiobutton';
import { useDictionary } from '../../../../../../../store/selectors/translations';
import { AppDispatch, StorageState } from '../../../../../../../store';
import { controller } from '../../../../../../../../main.tsx';
import { ProjectMode } from '../../../../../../../../model/domain.ts';

export const ProjectSettings = () => {
    const activeProgram = useSelector(useCurrentProgram);
    const project = useSelector(useCurrentProject);
    const dictionary = useSelector(useDictionary);
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

    const dispatch = useDispatch<AppDispatch>();
    const onModeChange = (projectMode: ProjectMode) => {
        dispatch(
            controller.onProjectModeChangeRequest({
                mode: projectMode,
                projectId: project?.projectId || 'default',
            })
        );
    };

    return (
        <div className="project-settings-dropdown">
            <Typography
                type="body-large"
                text={dictionary.viewer.mode.label}
                color={colors.gray10}
            />
            <div className="project-settings-dropdown__section">
                <Radio
                    id="markdown"
                    checked={mode === 'markdown'}
                    onChange={() => onModeChange('markdown')}
                    title={dictionary.viewer.mode.markdown}
                />
                <Radio
                    id="latex"
                    checked={mode === 'latex'}
                    onChange={() => onModeChange('latex')}
                    title={dictionary.viewer.mode.latex}
                />
            </div>
            <Typography
                type="body-large"
                text={dictionary.rounding_mode.label}
                color={colors.gray10}
            />
            <div className="project-settings-dropdown__section">
                <Radio
                    id="noRound"
                    checked={
                        activeProgram?.parameters.roundStrategy === 'noRound'
                    }
                    onChange={() =>
                        dispatch(
                            controller.onRoundStrategySetRequest({
                                strategy: 'noRound',
                            })
                        )
                    }
                    title={dictionary.rounding_mode.without_round}
                />
                <Radio
                    id="oneDigit"
                    checked={
                        activeProgram?.parameters.roundStrategy === 'oneDigit'
                    }
                    onChange={() =>
                        dispatch(
                            controller.onRoundStrategySetRequest({
                                strategy: 'oneDigit',
                            })
                        )
                    }
                    title={dictionary.rounding_mode.one_digit}
                />
                <Radio
                    id="twoDigits"
                    checked={
                        activeProgram?.parameters.roundStrategy === 'twoDigits'
                    }
                    onChange={() =>
                        dispatch(
                            controller.onRoundStrategySetRequest({
                                strategy: 'twoDigits',
                            })
                        )
                    }
                    title={dictionary.rounding_mode.two_digits}
                />
                <Radio
                    id="threeDigits"
                    checked={
                        activeProgram?.parameters.roundStrategy ===
                        'threeDigits'
                    }
                    onChange={() =>
                        dispatch(
                            controller.onRoundStrategySetRequest({
                                strategy: 'threeDigits',
                            })
                        )
                    }
                    title={dictionary.rounding_mode.three_digits}
                />
                <Radio
                    id="fixedNumber"
                    checked={
                        activeProgram?.parameters.roundStrategy === 'fiveDigits'
                    }
                    onChange={() =>
                        dispatch(
                            controller.onRoundStrategySetRequest({
                                strategy: 'fiveDigits',
                            })
                        )
                    }
                    title={dictionary.rounding_mode.five_digits}
                />
                <Radio
                    id="firstMeaningDigit"
                    checked={
                        activeProgram?.parameters.roundStrategy ===
                        'firstMeaningDigit'
                    }
                    onChange={() =>
                        dispatch(
                            controller.onRoundStrategySetRequest({
                                strategy: 'firstMeaningDigit',
                            })
                        )
                    }
                    title={dictionary.rounding_mode.first_digit}
                />
            </div>
        </div>
    );
};
