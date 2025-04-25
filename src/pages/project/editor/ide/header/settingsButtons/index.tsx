import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';

import './style.scss';

import { Input } from '../../../../../../components/input';
import { InterfaceTourAnchorClassnames } from '../../../../../../shared/components/tour/helpers';
import {
    BookIcon,
    CodeSettingsIcon,
    SearchIcon,
} from '../../../../../../shared/icons';
import { setSearch } from '../../../../../../store/slices/ide';
import { DropdownMenu } from '../../../../../../shared/components/dropdownMenu';
import { HeaderHelperItems } from './markdownType';
import { ProjectSettings } from './projectSettings';
import { useSearch } from '../../../../../../store/selectors/program';
import { useDictionary } from '../../../../../../store/selectors/translations';
import { StorageState } from '../../../../../../store';
import { setShowSearch } from '../../../../../../store/slices/settings';

export const SettingsButton = () => {
    const dispatch = useDispatch();
    const dictionary = useSelector(useDictionary);
    const search = useSelector(useSearch);
    const showSearch = useSelector(
        (state: StorageState) => state.settings.showSearch
    );

    const onSearchIconPress = () => {
        dispatch(setSearch(''));
        dispatch(setShowSearch(false));
    };

    const onChange = (e) => {
        dispatch(setSearch(e.target.value));
    };

    return (
        <div
            className={classNames(
                InterfaceTourAnchorClassnames.CodeSettings,
                'code-settings-header-container'
            )}
        >
            <div className="action-button">
                <DropdownMenu icon={<CodeSettingsIcon />}>
                    {showSearch ? null : <ProjectSettings />}
                </DropdownMenu>
            </div>
            <div className="action-button">
                <DropdownMenu icon={<BookIcon />}>
                    {showSearch ? null : <HeaderHelperItems />}
                </DropdownMenu>
            </div>
            <div
                onClick={() => dispatch(setShowSearch(true))}
                className="action-button"
            >
                <SearchIcon />
            </div>
            <Input
                ref={null}
                placeholder={`${dictionary.placeholder_search}...`}
                onClear={showSearch ? onSearchIconPress : undefined}
                onChange={onChange}
                className={classNames({
                    'input-hide': !showSearch,
                    'input-show': showSearch,
                })}
                value={search}
            />
        </div>
    );
};
