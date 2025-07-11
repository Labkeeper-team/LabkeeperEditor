import { useDispatch, useSelector } from 'react-redux';

import './style.scss';
import { AppDispatch } from '../../../../../../../../viewModel/store';
import { headerHelpItems } from '../../../../../../../../model/help';
import { onHelpItemCreatedRequest } from '../../../../../../../../controller';
import { useCurrentLanguage } from '../../../../../../../../viewModel/store/selectors/translations';

export const HeaderHelperItems = () => {
    const language = useSelector(useCurrentLanguage);
    const dispatch = useDispatch<AppDispatch>();

    return (
        <div className="markdown-select-dropdown">
            {headerHelpItems.map((item) => (
                <span
                    onClick={() =>
                        dispatch(onHelpItemCreatedRequest({ item: item }))
                    }
                >
                    {item.description[language]}
                </span>
            ))}
        </div>
    );
};
