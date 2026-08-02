import { useEffect } from 'react';

export const useLeavePageConfirmation = (isActive: boolean) => {
    useEffect(() => {
        if (!isActive) {
            return;
        }

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = 'true';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [isActive]);
};
