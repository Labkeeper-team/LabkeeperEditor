import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';

import './style.scss';

import { Input } from '../../../../../../components/input';
import { InterfaceTourAnchorClassnames } from '../../../../../../components/tour/helpers';
import {
    BookIcon,
    CodeSettingsIcon,
    SearchIcon,
} from '../../../../../../icons';
import { DropdownMenu } from '../../../../../../components/dropdownMenu';
import { HeaderHelperItems } from './markdownType';
import { ProjectSettings } from './projectSettings';
import { useSearch } from '../../../../../../store/selectors/program';
import { useDictionary } from '../../../../../../store/selectors/translations';
import { AppDispatch, StorageState } from '../../../../../../store';
import { setShowSearch } from '../../../../../../store/slices/settings';
import { controller } from '../../../../../../../main.tsx';
import { useIsMobile } from '../../../../../../hooks/useMobile';

export const SettingsButton = () => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const search = useSelector(useSearch);
    const isMobile = useIsMobile();
    const showSearch = useSelector(
        (state: StorageState) => state.settings.showSearch
    );

    return (
        <div
            className={classNames(
                InterfaceTourAnchorClassnames.CodeSettings,
                'code-settings-header-container',
                {
                    'code-settings-header-container--mobile': isMobile,
                }
            )}
        >
            <div className="action-button">
                <DropdownMenu icon={<CodeSettingsIcon />} fullScreenOnMobile>
                    {showSearch ? null : <ProjectSettings />}
                </DropdownMenu>
            </div>
            <div className="action-button">
                <DropdownMenu icon={<BookIcon />} fullScreenOnMobile>
                    {showSearch ? null : <HeaderHelperItems />}
                </DropdownMenu>
            </div>
            <div
                onClick={() => dispatch(setShowSearch(true))}
                className={classNames('action-button', {
                    'action-button--search-hidden': showSearch,
                })}
            >
                <SearchIcon />
            </div>
            <Input
                ref={null}
                placeholder={`${dictionary.placeholder_search}...`}
                onClear={
                    showSearch
                        ? () => dispatch(controller.onSearchIconPressRequest())
                        : undefined
                }
                onChange={(e) => {
                    dispatch(
                        controller.onSearchInputChangedRequest({
                            text: e.target.value,
                        })
                    );
                }}
                className={classNames({
                    'input-hide': !showSearch,
                    'input-show': showSearch,
                })}
                value={search}
            />
        </div>
    );
};
