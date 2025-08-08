import { createBrowserRouter } from 'react-router-dom';
import { Routes } from './routes';
import { BaseLayout } from '../components/layout';
import { ProjectPage } from '../pages/project';
import { HomePage } from '../pages/home';
import { ProjectsPage } from '../pages/projects';
import { CodePage } from '../pages/code';
import { QrPage } from '../pages/qr';

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
