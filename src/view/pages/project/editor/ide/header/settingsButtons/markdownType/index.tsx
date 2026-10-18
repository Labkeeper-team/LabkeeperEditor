import { useDispatch, useSelector } from 'react-redux';

import './style.scss';
import { AppDispatch } from '../../../../../../../store';
import { headerHelpItems } from '../../../../../../../../model/help';
import {
    useCurrentLanguage,
    useDictionary,
} from '../../../../../../../store/selectors/translations';
import { setShowHotkeysHelp } from '../../../../../../../store/slices/settings';
import { controller } from '../../../../../../../../main.tsx';
import { useDropdownClose } from '../../../../../../../components/dropdownMenu/context';
import { useIsMobile } from '../../../../../../../hooks/useMobile';

export const HeaderHelperItems = () => {
    const language = useSelector(useCurrentLanguage);
    const dispatch = useDispatch<AppDispatch>();
    const closeMenu = useDropdownClose();
    const isMobile = useIsMobile();
    const dictionary = useSelector(useDictionary);

    return (
        <div className="markdown-select-dropdown">
            {/* GH-172: список сочетаний живёт в справке шапки, своя кнопка не поместилась бы в узкую колонку */}
            {isMobile ? null : (
                <>
                    <span
                        className="markdown-select-dropdown__hotkeys"
                        onClick={() => {
                            closeMenu?.();
                            dispatch(setShowHotkeysHelp(true));
                        }}
                    >
                        {dictionary.hotkeys.open}
                    </span>
                    <div
                        className="markdown-select-dropdown__divider"
                        role="separator"
                    />
                </>
            )}
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
