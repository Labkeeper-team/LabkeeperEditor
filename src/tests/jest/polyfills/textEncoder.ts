import { TextDecoder, TextEncoder } from 'util';

// react-router 7 при загрузке берёт TextEncoder, а в jsdom из jest его нет.
// Импортировать первым, до react-router
Object.assign(globalThis, { TextEncoder, TextDecoder });
