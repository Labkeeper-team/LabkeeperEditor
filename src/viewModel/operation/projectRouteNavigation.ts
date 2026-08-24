let preloadedProjectPath: string | undefined;

export const markNextProjectRouteAsPreloaded = (pathname: string): void => {
    preloadedProjectPath = pathname;
};

export const consumePreloadedProjectRoute = (pathname: string): boolean => {
    const isPreloadedRoute = preloadedProjectPath === pathname;
    preloadedProjectPath = undefined;
    return isPreloadedRoute;
};
