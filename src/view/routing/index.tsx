import { createBrowserRouter } from 'react-router-dom';
import { Routes } from '../../viewModel/routes.ts';
import { BaseLayout } from '../components/layout';
import { HomePage } from '../pages/home';
import { ProjectsPage } from '../pages/projects';
import { CodePage } from '../pages/code';
import { QrPage } from '../pages/qr';
import { RouterErrorBoundary } from '../pages/error';
import { lazy, Suspense } from 'react';

import './style.scss';
import { SuspenseLoader } from '../components/suspenseLoader/index.tsx';

// eslint-disable-next-line react-refresh/only-export-components
const ProjectPage = lazy(() => {
    return Promise.all([
        import('../pages/project'),
        new Promise((resolve) => setTimeout(resolve, 1000)),
    ]).then(([moduleExport]) => moduleExport);
});

export const appRouter = createBrowserRouter([
    {
        path: Routes.Home,
        element: (
            <div className="fade-in">
                <BaseLayout />
            </div>
        ),
        errorElement: <RouterErrorBoundary />,
        children: [
            {
                path: Routes.Home,
                element: <HomePage />,
            },
            {
                path: Routes.Project,
                element: (
                    <Suspense fallback={<SuspenseLoader />}>
                        <div className="fade-in">
                            <ProjectPage />
                        </div>
                    </Suspense>
                ),
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
