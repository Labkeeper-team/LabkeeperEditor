import { useDispatch, useSelector } from 'react-redux';

import './style.scss';
import {
    AppDispatch,
    StorageState,
} from '../../../../../../../../viewModel/store';
import { headerHelpItems } from '../../../../../../../../model/help';
import { onHelpItemCreatedRequest } from '../../../../../../../../controller';

export const HeaderHelperItems = () => {
    const language = useSelector(
        (state: StorageState) => state.persistence.language
    );
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
