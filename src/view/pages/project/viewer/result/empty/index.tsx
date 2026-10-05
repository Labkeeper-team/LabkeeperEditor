import { useSelector } from 'react-redux';
import { useDictionary } from '../../../../../store/selectors/translations';
import { useIsAgentMode } from '../../../../../hooks/useAgentMode';

export const EmptyResultContainer = () => {
    const dictionary = useSelector(useDictionary);
    const isAgentMode = useIsAgentMode();
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
            {isAgentMode ? (
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
