import { createViewModelStateFromStore, store } from './view/store';
import { setupContext } from './viewModel/context.ts';
import { MetrikaService } from './web/yandex';
import { WebRpi } from './web/server';

export const { controller } = setupContext(
    new WebRpi(),
    createViewModelStateFromStore(store),
    new MetrikaService()
);
