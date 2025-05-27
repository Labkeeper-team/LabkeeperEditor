import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';

import App from './view/App.tsx';
import { ProgramService } from './model/service/program.ts';
import { store } from './viewModel/store';
import { createViewModelStateFromStore } from './viewModel/viewModelState';
import { Rpi } from './model/rpi';
import { SystemService } from './viewModel';
import { LoaderService } from './viewModel/project.ts';
import { StartupService } from './viewModel/init.ts';
import { CompilationService } from './viewModel/compile.ts';
import { IdeService } from './viewModel/ide.ts';
import { ObserverService } from './model/service/observer.ts';
import { MetrikaService } from './web/yandex';
import { Secrets } from './constants.ts';

export const observerService: ObserverService = new MetrikaService();
export const repository = createViewModelStateFromStore(store);
export const programService: ProgramService = new ProgramService();
export const rpi: Rpi = new Rpi();
export const loaderService: LoaderService = new LoaderService(rpi, repository);
export const startupService: StartupService = new StartupService(
    rpi,
    programService,
    loaderService,
    repository
);
export const compilationService: CompilationService = new CompilationService(
    repository,
    rpi,
    programService,
    loaderService,
    observerService
);
export const ideService: IdeService = new IdeService(repository);
export const systemService: SystemService = new SystemService(
    repository,
    rpi,
    programService,
    loaderService,
    ideService,
    startupService,
    compilationService,
    observerService
);

programService.setProgramChnagedCallback((currentProgram) =>
    systemService.onProgramUpdated(currentProgram)
);

Sentry.init({
    dsn: Secrets.sentryDsn,
    sendDefaultPii: true,
    integrations: [],
});

createRoot(document.getElementById('root')!, {
    onRecoverableError: Sentry.reactErrorHandler(),
}).render(
    <StrictMode>
        <App />
    </StrictMode>
);
