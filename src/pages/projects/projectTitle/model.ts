import { ProjectShort } from '../../../shared/models/project';

export interface ProjectTItleProps {
  project: ProjectShort;
  onSuccessRename?: () => any;
}
