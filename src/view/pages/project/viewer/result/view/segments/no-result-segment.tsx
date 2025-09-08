import { Typography } from '../../../../../../components/typography';
import { useDictionary } from '../../../../../../store/selectors/translations.ts';
import { useSelector } from 'react-redux';
import { colors } from '../../../../../../styles/colors.ts';

export const NoResultSegment = () => {
    const dictionary = useSelector(useDictionary);

    return (
        <div className="markdown-body">
            <Typography
                color={colors.gray10}
                text={dictionary.segment.no_computation_result}
                type={'body-large'}
            />
            <Typography
                color={colors.gray50}
                text={dictionary.segment.run_to_view}
                type={'label-small'}
            />
        </div>
    );
};
