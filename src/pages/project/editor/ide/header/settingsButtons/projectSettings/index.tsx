import { useDispatch, useSelector } from 'react-redux';
import {
    useCurrentProgram,
    useIsAutocompilationEnabeled,
    useIsHightlight,
} from '../../../../../../../store/selectors/program';
import { setProgramRoundStrategy } from '../../../../../../../store/slices/project';

import './style.scss';
import { ProgramRoundStrategy } from '../../../../../../../shared/models/project';
import { Checkbox } from '../../../../../../../componenets/checkbox';
import { Typography } from '../../../../../../../componenets/typography';
import {
    setAutocompilation,
    setHighlight,
} from '../../../../../../../store/slices/ide';
import { colors } from '../../../../../../../shared/styles/colors';
import { Radio } from '../../../../../../../componenets/radiobutton';
import { useDictionary } from '../../../../../../../store/selectors/translations';

export const ProjectSettings = () => {
    const activeProgram = useSelector(useCurrentProgram);
    const isAutoCompilationEnabled = useSelector(useIsAutocompilationEnabeled);
    const isHightlight = useSelector(useIsHightlight);
    const dictionary = useSelector(useDictionary);

    const dispatch = useDispatch();

    const onClick = (roundStrategy: ProgramRoundStrategy) => {
        dispatch(setProgramRoundStrategy(roundStrategy));
    };

    const onChangeAutoCompilation = (newValue: boolean) => {
        dispatch(setAutocompilation(newValue));
    };

    const onChangeHighlighting = (newValue: boolean) => {
        dispatch(setHighlight(newValue));
    };

    return (
        <div className="project-settings-dropdown">
            <Typography
                type="body-large"
                text={dictionary.rounding_mode.label}
                color={colors.gray10}
            />
            <div
                style={{
                    marginTop: 6,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                }}
            >
                <Radio
                    id="noRound"
                    checked={
                        activeProgram?.parameters.roundStrategy === 'noRound'
                    }
                    onChange={() => onClick('noRound')}
                    title={dictionary.rounding_mode.without_round}
                />
                <Radio
                    id="firstMeaningDigit"
                    checked={
                        activeProgram?.parameters.roundStrategy ===
                        'firstMeaningDigit'
                    }
                    onChange={() => onClick('firstMeaningDigit')}
                    title={dictionary.rounding_mode.first_digit}
                />
                <Radio
                    id="fixedDigits"
                    checked={
                        activeProgram?.parameters.roundStrategy ===
                        'fixedDigits'
                    }
                    onChange={() => onClick('fixedDigits')}
                    title={dictionary.rounding_mode.fixed_number}
                />
            </div>
            <div
                style={{
                    marginTop: 10,
                    paddingTop: 5,

                    paddingBottom: 5,
                    borderTop: '1px solid #D4DEF6',
                    borderBottom: '1px solid #D4DEF6',
                }}
            >
                <Checkbox
                    id="set-highlight"
                    checked={isHightlight}
                    onChange={onChangeHighlighting}
                    title={dictionary.label_syntax_highlight}
                />
            </div>
            <div style={{ paddingTop: 5 }}>
                <Checkbox
                    id="set-autocompilation"
                    checked={isAutoCompilationEnabled}
                    onChange={onChangeAutoCompilation}
                    title={dictionary.label_autocompilation}
                />
            </div>
        </div>
    );
};
