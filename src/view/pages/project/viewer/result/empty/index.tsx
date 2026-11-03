import { useSelector } from 'react-redux';
import { useDictionary } from '../../../../../store/selectors/translations';
import { useIsAgentMode } from '../../../../../hooks/useAgentMode';
import { StorageState } from '../../../../../store';

export const EmptyResultContainer = () => {
    const dictionary = useSelector(useDictionary);
    const isAgentMode = useIsAgentMode();
    const isCompiling = useSelector(
        (state: StorageState) => state.settings.isCompiling
    );
    return (
        <div
            style={{
                display: 'flex',
                fontSize: '20px',
                lineHeight: '20px',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
                textAlign: 'center',
            }}
        >
            {/* в агентском режиме кнопки «Выполнить» нет, документ собирает агент */}
            {isCompiling ? (
                dictionary.viewer.compiling
            ) : isAgentMode ? (
                dictionary.agent_mode.no_pdf
            ) : (
                <>
                    {dictionary.label_no_result_part1}
                    <br /> {dictionary.label_no_result_part2}
                </>
            )}
        </div>
    );
};
