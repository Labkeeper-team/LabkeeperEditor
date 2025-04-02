import { ShareIcon } from '../../../shared/icons';
import './style.scss';
import {useCurrentProject} from "../../../store/selectors/program.ts";
import {useSelector} from "react-redux";


export const ShareButton = () => {
  const project = useSelector(useCurrentProject)

  if (!project || !project.title) {
    return null;
  }

  return (
    <button className="share-button" onClick={() => {}}>
      <ShareIcon />
    </button>
  );
}; 