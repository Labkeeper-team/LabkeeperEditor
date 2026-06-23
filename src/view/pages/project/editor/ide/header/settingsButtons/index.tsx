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
    const isMobile = useIsMobile();
    const search = useSelector(useSearch);
    const showSearch = useSelector(
        (state: StorageState) => state.settings.showSearch
    );
    const undoEnabled = useSelector(
        (state: StorageState) => state.ide.undoEnabled
    );
    const redoEnabled = useSelector(
        (state: StorageState) => state.ide.redoEnabled
    );

    if (isMobile) {
        return (
            <div
                className={classNames(
                    InterfaceTourAnchorClassnames.CodeSettings,
                    'code-settings-header-container'
                )}
            >
                <div className="action-button">
                    <DropdownMenu
                        icon={<CodeSettingsIcon />}
                        containerClassname="mobile-settings-fullscreen-menu"
                    >
                        {showSearch ? null : (
                            <>
                                <ProjectSettings />
                                <div className="mobile-dropdown-separator" />
                                <HeaderHelperItems />
                                <div className="mobile-dropdown-separator" />
                                <div className="mobile-dropdown-actions">
                                    <button
                                        type="button"
                                        className="mobile-dropdown-action-button"
                                        disabled={!undoEnabled}
                                        onClick={() =>
                                            dispatch(
                                                controller.onPrevVersionButtonClickedRequest()
                                            )
                                        }
                                    >
                                        Undo
                                    </button>
                                    <button
                                        type="button"
                                        className="mobile-dropdown-action-button"
                                        disabled={!redoEnabled}
                                        onClick={() =>
                                            dispatch(
                                                controller.onNextVersionButtonClickedRequest()
                                            )
                                        }
                                    >
                                        Redo
                                    </button>
                                    <div className="mobile-dropdown-separator mobile-dropdown-separator--inner" />
                                    <button
                                        type="button"
                                        className="mobile-dropdown-action-button"
                                        onClick={() =>
                                            dispatch(setShowSearch(true))
                                        }
                                    >
                                        Search
                                    </button>
                                </div>
                            </>
                        )}
                    </DropdownMenu>
                </div>
                <Input
                    ref={null}
                    placeholder={`${dictionary.placeholder_search}...`}
                    onClear={
                        showSearch
                            ? () =>
                                  dispatch(
                                      controller.onSearchIconPressRequest()
                                  )
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
    }

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
