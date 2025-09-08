import { useDispatch, useSelector } from 'react-redux';

import './style.scss';
import { AppDispatch } from '../../../../../../../store';
import { headerHelpItems } from '../../../../../../../../model/help';
import { useCurrentLanguage } from '../../../../../../../store/selectors/translations';
import { controller } from '../../../../../../../../main.tsx';

export const HeaderHelperItems = () => {
    const language = useSelector(useCurrentLanguage);
    const dispatch = useDispatch<AppDispatch>();

    return (
        <div className="markdown-select-dropdown">
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
