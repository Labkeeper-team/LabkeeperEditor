import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { StorageState } from '../store';
import { collabService } from '../../main.tsx';

/**
 * Keeps the collaboration session of the open project: started when a saved project
 * is open for an authenticated user, stopped when the page leaves the project. The
 * service itself checks the feature flag, so with the flag off no socket is opened.
 */
export const useCollabSession = (): void => {
    const projectId = useSelector(
        (state: StorageState) => state.project.project?.projectId
    );
    const isAuthenticated = useSelector(
        (state: StorageState) => state.user.isAuthenticated
    );

    useEffect(() => {
        if (!collabService || !projectId || !isAuthenticated) {
            return;
        }
        collabService.start(projectId);
        return () => collabService?.stop(projectId);
    }, [projectId, isAuthenticated]);
};
