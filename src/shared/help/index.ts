import { SegmentType } from '../models/project.ts';

export interface HeaderHelpItem {
    description: {
        ru: string;
        en: string;
    };
    segmentType: SegmentType;
    text: {
        ru: string;
        en: string;
    };
}

export interface EditorHelpItem {
    description: string;
    text: string;
}

export interface LocalizedInstructionItem {
    ru: InstructionItem;
    en: InstructionItem;
}

export interface InstructionItem {
    title: string;
    points: string[];
    image: string;
    ending: string;
    wikiLink: string;
}

export const headerHelpItems: HeaderHelpItem[] = [
    {
        description: {
            ru: 'Массив',
            en: 'Array',
        },
        segmentType: 'computational',
        text: {
            ru: `my_array = [1, 2, 3, 4]`,
            en: `my_array = [1, 2, 3, 4]`,
        },
    },
    {
        description: {
            ru: 'Формула',
            en: 'Formula',
        },
        segmentType: 'md',
        text: {
            ru: 'Формула с интегралом: $\\int f(x) dx = F(x)$',
            en: 'My formula with integral: $\\int f(x) dx = F(x)$',
        },
    },
];

export const editorHelpItems: EditorHelpItem[] = [
    {
        description: 'Array',
        text: 'a = [1, 2, 3, 4, 5]',
    },
    {
        description: 'Variable with error',
        text: 'a = 10 # 1',
    },
];

const wikiRuUrl = 'https://github.com/labkeeper-team/docs/wiki/ru';
const wikiEnUrl = 'https://github.com/labkeeper-team/docs/wiki/en';

const basicEndingRu = 'Больше информации доступно на';
const basicEndingEn = 'More information on';

export const instructions: LocalizedInstructionItem[] = [
    {
        ru: {
            title: 'Добро пожаловать',
            points: [
                'labkeeper.io - приложение, позволяющее объединить верстку и вычисления',
                `
                Пишите красивые тексты с использованием markdown и latex,
                используйте научный калькулятор для ваших вычислений.
                Экспортируйте ваши документы в pdf.
                `,
            ],
            image: '/instructions/welcome.png',
            ending: basicEndingRu,
            wikiLink: wikiRuUrl,
        },
        en: {
            title: 'Welcome',
            points: [
                'labkeeper.io - combines markdown text editor with scientific calculator',
                `
                Write beautiful texts using markdown and latex,
                Use a scientific calculator for your calculations.
                Export your documents to pdf.
                `,
            ],
            ending: basicEndingEn,
            wikiLink: wikiEnUrl,
            image: '/instructions/welcome.png',
        },
    },
    {
        ru: {
            title: 'Быстрый старт',
            points: [
                `
                Создайте сегмент нужного типа.
                Markdown нужен для текста.
                Вычисление позволяет считать выражения`,
                'Напишите что-нибудь',
                'Нажмите кнопку Выполнить',
            ],
            image: '/instructions/quick_start.png',
            ending: basicEndingRu,
            wikiLink: wikiRuUrl,
        },
        en: {
            title: 'Quick start',
            points: [
                `
                Create a segment with required type.
                Markdown helps you render text and images.
                Computation lets you perform custom calculations
                and then insert the result into other segments`,
                'Write some text in it',
                'Press the run button',
            ],
            ending: basicEndingEn,
            wikiLink: wikiEnUrl,
            image: '/instructions/quick_start.png',
        },
    },
    {
        ru: {
            title: 'Вставка результатов вычислений',
            points: [
                'Создайте вычислительный и markdown сегменты',
                'Добавьте переменную и воспользуйтесь оператором ${}',
                'Нажмите кнопку Выполнить',
            ],
            image: '/instructions/md_insert.png',
            ending: basicEndingRu,
            wikiLink: wikiRuUrl,
        },
        en: {
            title: 'Insert computation result into text',
            points: [
                'Create computational and markdown segments',
                'Add new variable and use operator ${} to reference it',
                'Press the run button',
            ],
            image: '/instructions/md_insert.png',
            ending: basicEndingEn,
            wikiLink: wikiEnUrl,
        },
    },
    {
        ru: {
            title: 'Вставка картинок в markdown',
            points: [
                'Загрузите картинку в буфер обмена (можно нажать CTRL+C на файле, либо копировать картинку в браузере)',
                'Создайте markdown сегмент и нажмите CTRL+V',
                'Нажмите кнопку Выполнить',
            ],
            image: '/instructions/image_insert.png',
            ending: basicEndingRu,
            wikiLink: wikiRuUrl,
        },
        en: {
            title: 'Add an image into markdown',
            points: [
                'Load image into clipboard (use CTRL+C on image file, or click copy image in browser)',
                'Create markdown segment and click CTRL+V',
                'Press the run button',
            ],
            image: '/instructions/image_insert.png',
            ending: basicEndingEn,
            wikiLink: wikiEnUrl,
        },
    },
    {
        ru: {
            title: 'Использование простых формул',
            points: [
                'Создайте сегмент с простой формулой',
                'Напишите какую-нибудь математику в упрощенном формате (без тегов)',
                'Нажмите кнопку Выполнить',
            ],
            image: '/instructions/simple_formula.png',
            ending: basicEndingRu,
            wikiLink: wikiRuUrl,
        },
        en: {
            title: 'Simple formulas segment usage',
            points: [
                'Create a simple formula segment',
                'Write some math in simplified way (without latex tags)',
                'Press the run button',
            ],
            image: '/instructions/simple_formula.png',
            ending: basicEndingEn,
            wikiLink: wikiEnUrl,
        },
    },
    {
        ru: {
            title: 'Рисование графиков',
            points: [
                'Создайте вычислительный сегмент и используйте функцию plot',
                'Нажмите кнопку Выполнить',
                'В функции plot можно рисовать несколько кривых, указывать их тип и цвет: plot(x1=, y1=, x2=, y2=, type1="line")',
            ],
            image: '/instructions/draw_plot.png',
            ending: basicEndingRu,
            wikiLink: wikiRuUrl,
        },
        en: {
            title: 'Drawing plots',
            points: [
                'Create computation segment and user plot function',
                'Click the run button',
                'You can specify curves count, color, type and other in plot function: plot(x1=, y1=, x2=, y2=, type1="line")',
            ],
            image: '/instructions/draw_plot.png',
            ending: basicEndingRu,
            wikiLink: wikiEnUrl,
        },
    },
    {
        ru: {
            title: 'Печать в pdf',
            points: [
                'Создайте несколько сегментов',
                'Нажмите кнопку Выполнить',
                'Нажмите кнопку Печать в pdf, далее вы сможете сохранить получившийся файл',
                'Важно! Обязательно выбирайте пункт "сохранить как PDF", иначе символы нельзя будет выделить',
            ],
            image: '/instructions/print_pdf.png',
            ending: basicEndingRu,
            wikiLink: wikiRuUrl,
        },
        en: {
            title: 'Print to pdf',
            points: [
                'Create some segments',
                'Press the run button',
                'Press Print to pdf button, then you can save pdf as a file',
                'Warning! You may use "Save as PDF" option, otherwise symbols will not be selected',
            ],
            image: '/instructions/print_pdf.png',
            ending: basicEndingRu,
            wikiLink: wikiEnUrl,
        },
    },
];
