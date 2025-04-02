import { useDispatch, useSelector } from 'react-redux';
import './style.scss';
import { AddBlock } from '../addBlock';
import { HistoryButtons } from './historyButtons';
import {useCurrentProgram, useUser} from '../../../../../store/selectors/program';
import { SettingsButton } from './settingsButtons';
import { FolderIcon } from '../../../../../shared/icons';
import { StorageState } from '../../../../../store';
import { setShoFileManager } from '../../../../../store/slices/settings';

export const IdeHeader = () => {
  const program = useSelector(useCurrentProgram);
  const {isAuthenticated} = useSelector(useUser);
  const dispatch = useDispatch();
  const showFileManager = useSelector((state: StorageState) => state.settings.showFileManager);
  const isReadonly = useSelector((state: StorageState) => state.project.projectIsReadonly);
  const onPressFolder = () => {
    dispatch(setShoFileManager(true))
  }
  return (
    <div className="ide-header">
      <div style={{display: 'flex', flexDirection: 'row', alignItems:'center', gap: 24}}>
      {isAuthenticated ? !showFileManager  ?<div className='file-manager-button ' onClick={onPressFolder}>
        <FolderIcon />
      </div> : null : null}
          {!isReadonly && <HistoryButtons />}
      </div>
      {(program?.segments.length && !isReadonly)  ? <AddBlock isFirst={false} /> : <div />}
        {!isReadonly && <SettingsButton />}
    </div>
  );
};
