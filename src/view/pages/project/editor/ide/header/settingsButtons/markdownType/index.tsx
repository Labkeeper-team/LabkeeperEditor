import { useDispatch, useSelector } from 'react-redux';

import './style.scss';
import { AppDispatch } from '../../../../../../../store';
import { headerHelpItems } from '../../../../../../../../model/help';
import { useCurrentLanguage } from '../../../../../../../store/selectors/translations';
import { controller } from '../../../../../../../../main.tsx';
import { useDropdownClose } from '../../../../../../../components/dropdownMenu/context';
import { useIsMobile } from '../../../../../../../hooks/useMobile';

export const HeaderHelperItems = () => {
    const language = useSelector(useCurrentLanguage);
    const dispatch = useDispatch<AppDispatch>();
    const closeMenu = useDropdownClose();
    const isMobile = useIsMobile();

    return (
        <div className="markdown-select-dropdown">
            {headerHelpItems.map((item, index) => (
                <span
                    key={index}
                    onClick={() => {
                        dispatch(
                            controller.onHelpItemCreatedRequest({ item: item })
                        );
                        if (isMobile) {
                            closeMenu?.();
                        }
                    }}
                >
                    {item.description[language]}
                </span>
            ))}
        </div>
    );
};
