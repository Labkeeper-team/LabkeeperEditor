// На один переход сохраняем адрес уже загруженного проекта, например /project/123
// Это не даёт смене URL запустить повторную загрузку этого проекта
let preloadedProjectPath: string | undefined;

export const markNextProjectRouteAsPreloaded = (pathname: string): void => {
    preloadedProjectPath = pathname;
};

export const consumePreloadedProjectRoute = (pathname: string): boolean => {
    const isPreloadedRoute = preloadedProjectPath === pathname;
    preloadedProjectPath = undefined;
    return isPreloadedRoute;
};
