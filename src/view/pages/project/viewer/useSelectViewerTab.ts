import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, StorageState } from '../../../store';
import { setViewerTab } from '../../../store/slices/settings';
import { controller } from '../../../../main.tsx';
import { Events } from '../../../../model/service/ObserverService.ts';
import { ViewerTab } from '../../../store/slices';

/** Смена вкладки с тем же событием, что у клика: ею пользуются и вкладки, и Ctrl+Alt+P / Ctrl+Alt+C (GH-172) */
export const useSelectViewerTab = () => {
    const dispatch = useDispatch<AppDispatch>();
    const viewerTab = useSelector(
        (state: StorageState) => state.settings.viewerTab
    );
    return useCallback(
        (tab: ViewerTab) => {
            if (viewerTab !== tab) {
                controller.trackUiEvent(Events.EVENT_VIEWER_TAB_CHANGED, {
                    from: viewerTab,
                    to: tab,
                });
            }
            dispatch(setViewerTab(tab));
        },
        [dispatch, viewerTab]
    );
};
