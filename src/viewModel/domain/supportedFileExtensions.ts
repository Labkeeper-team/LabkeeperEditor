/**
 * Расширения, которые редактор принимает в проект. Классы и пакеты LaTeX
 * (`.cls`, `.sty`) нужны шаблонам вроде AltaCV: без них проект не собирается
 *
 * Один список на проверку файла и на атрибут `accept` поля выбора: когда они
 * разъезжаются, проверка пропускает формат, который браузер в диалоге уже
 * отсеял, и пользователь видит, что файл просто нельзя выбрать
 */
export const SUPPORTED_EXTENSIONS = [
    '.png',
    '.jpg',
    '.jpeg',
    '.svg',
    '.txt',
    '.csv',
    '.tex',
    '.bib',
    '.bst',
    '.cls',
    '.sty',
] as const;

/** Значение для атрибута `accept` у input[type=file] */
export const SUPPORTED_EXTENSIONS_ACCEPT = SUPPORTED_EXTENSIONS.join(', ');
