import { createBrowserRouter } from 'react-router-dom';
import { Routes } from './routes';
import { BaseLayout } from '../componenets/layout';
import { ProjectPage } from '../pages/project';
import { HomePage } from '../pages/home';
import { ProjectsPage } from '../pages/projects';

export const appRouter = createBrowserRouter([
    {
        path: Routes.Home,
        element: <BaseLayout></BaseLayout>,
        children: [
            {
                path: Routes.Home,
                element: <HomePage />,
            },
            {
                path: Routes.Project,
                element: <ProjectPage />,
            },
            {
                path: Routes.Projects,
                element: <ProjectsPage />,
            },
        ],
    },
]);
