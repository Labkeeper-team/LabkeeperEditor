import { createBrowserRouter } from 'react-router-dom';
import { Routes } from '../../viewModel/routes.ts';
import { BaseLayout } from '../components/layout';
import { ProjectPage } from '../pages/project';
import { HomePage } from '../pages/home';
import { ProjectsPage } from '../pages/projects';
import { CodePage } from '../pages/code';
import { QrPage } from '../pages/qr';
import { RouterErrorBoundary } from '../pages/error';

export const appRouter = createBrowserRouter([
    {
        path: Routes.Home,
        element: <BaseLayout></BaseLayout>,
        errorElement: <RouterErrorBoundary />,
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
            {
                path: Routes.CodePage,
                element: <CodePage />,
            },
            {
                path: Routes.QrPage,
                element: <QrPage />,
            },
        ],
    },
]);
