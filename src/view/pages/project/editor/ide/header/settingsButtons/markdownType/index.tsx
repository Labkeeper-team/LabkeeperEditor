import { useDispatch, useSelector } from 'react-redux';

import './style.scss';
import { AppDispatch } from '../../../../../../../store';
import { headerHelpItems } from '../../../../../../../../model/help';
import {
    useCurrentLanguage,
    useDictionary,
} from '../../../../../../../store/selectors/translations';
import { controller } from '../../../../../../../../main.tsx';
import { Typography } from '../../../../../../../components/typography';
import { colors } from '../../../../../../../styles/colors';

export const HeaderHelperItems = () => {
    const language = useSelector(useCurrentLanguage);
    const dictionary = useSelector(useDictionary);
    const dispatch = useDispatch<AppDispatch>();

    return (
        <div className="markdown-select-dropdown">
            <Typography
                className="markdown-select-dropdown__title"
                type="body-large"
                color={colors.gray10}
                text={dictionary.instructions.label}
            />
            {headerHelpItems.map((item, index) => (
                <span
                    key={index}
                    onClick={() =>
                        dispatch(
                            controller.onHelpItemCreatedRequest({ item: item })
                        )
                    }
                >
                    {item.description[language]}
                </span>
            ))}
        </div>
    );
};
