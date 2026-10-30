import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';
import { useCurrentProgram } from '../../../../../../../store/selectors/program';

import './style.scss';
import { Typography } from '../../../../../../../components/typography';
import { colors } from '../../../../../../../styles/colors';
import { Radio } from '../../../../../../../components/radiobutton';
import { useDictionary } from '../../../../../../../store/selectors/translations';
import { AppDispatch, StorageState } from '../../../../../../../store';
import { controller } from '../../../../../../../../main.tsx';
import {
    ProjectExportFormat,
    ProjectType,
} from '../../../../../../../../model/domain.ts';
import { useAgentModeNavigation } from '../../../../../../../hooks/useAgentMode';
import { useIsProjectReadonly } from '../../../../../../../store/selectors/program';
import { useIsMobile } from '../../../../../../../hooks/useMobile';
import { HintTooltip } from '../../../../../../../components/hintTooltip';

const EXPORT_HINT_TOOLTIP_ID = 'project-export-hint';

const EXPORT_FORMATS: {
    format: ProjectExportFormat;
    title: 'labkeeper' | 'tex';
    hint: 'labkeeper_hint' | 'tex_hint';
}[] = [
    { format: 'labkeeper', title: 'labkeeper', hint: 'labkeeper_hint' },
    { format: 'tex', title: 'tex', hint: 'tex_hint' },
];

export const ProjectSettings = () => {
    const activeProgram = useSelector(useCurrentProgram);
    const dictionary = useSelector(useDictionary);
    const mode = useSelector((state: StorageState) => state.project.mode);

    const isReadonly = useSelector(useIsProjectReadonly);
    const exporting = useSelector(
        (state: StorageState) => state.settings.exportingProject
    );
    const isMobile = useIsMobile();
    const { enterAgentMode } = useAgentModeNavigation();

    const dispatch = useDispatch<AppDispatch>();
    const onTypeChange = (projectType: ProjectType) => {
        dispatch(
            controller.onProjectModeChangeRequest({
                type: projectType,
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
                    onChange={() => onTypeChange('markdown')}
                    title={dictionary.viewer.mode.markdown}
                />
                <Radio
                    id="latex"
                    checked={mode === 'latex'}
                    onChange={() => onTypeChange('latex')}
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
            {/* GH-211: у каждого формата описание, что окажется в архиве */}
            <Typography
                type="body-large"
                text={dictionary.project_export.label}
                color={colors.gray10}
            />
            <div className="project-settings-dropdown__section project-export">
                {EXPORT_FORMATS.map(({ format, title, hint }) => (
                    <button
                        key={format}
                        type="button"
                        className={classNames('project-export__option', {
                            'project-export__option--busy':
                                exporting === format,
                        })}
                        data-export-format={format}
                        // на компьютере описание всплывает, чтобы кнопки не занимали полменю
                        data-tooltip-content={
                            isMobile
                                ? undefined
                                : dictionary.project_export[hint]
                        }
                        data-tooltip-id={
                            isMobile ? undefined : EXPORT_HINT_TOOLTIP_ID
                        }
                        disabled={exporting !== null}
                        onClick={() =>
                            dispatch(controller.onExportProjectRequest(format))
                        }
                    >
                        <strong className="project-export__title">
                            {exporting === format
                                ? dictionary.project_export.preparing
                                : dictionary.project_export[title]}
                        </strong>
                        {/* на телефоне наведения нет, а меню во весь экран: описание прямо под названием */}
                        {isMobile ? (
                            <small className="project-export__hint">
                                {dictionary.project_export[hint]}
                            </small>
                        ) : null}
                    </button>
                ))}
                {isMobile ? null : (
                    <HintTooltip
                        id={EXPORT_HINT_TOOLTIP_ID}
                        isMobile={false}
                        place="right"
                        // тёмная, как подсказки с сочетаниями: светлая сливается с редактором
                        variant="dark"
                        maxWidth={300}
                    />
                )}
            </div>
            {/* на чужом проекте агента запускать некуда, как и на вкладке агента */}
            {isReadonly ? null : (
                <button
                    type="button"
                    className="project-settings-dropdown__agent-mode"
                    title={dictionary.agent_mode.enter_hint}
                    onClick={() => enterAgentMode('project_settings')}
                >
                    {dictionary.agent_mode.enter}
                </button>
            )}
        </div>
    );
};
