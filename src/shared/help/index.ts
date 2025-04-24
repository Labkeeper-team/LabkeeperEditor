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
        description: "Array",
        text: "a = [1, 2, 3, 4, 5]"
    },
    {
        description: "Variable with error",
        text: "a = 10 # 1"
    }
];

const wikiRuUrl = 'https://github.com/labkeeper-team/docs/wiki/ru';
const wikiEnUrl = 'https://github.com/labkeeper-team/docs/wiki/en';

export const instructions: LocalizedInstructionItem[] = [
    {
        ru: {
            title: 'Быстрый старт',
            points: [
                `
                Создайте сегмент нужного типа.
                Markdown нужен для текста.
                Вычисление позволяет считать выражения.`,
                'Напишите что-нибудь',
                'Нажмите кнопку Выполнить',
            ],
            image: '/instructions/quick_start.png',
            ending: 'Больше информации доступно на {wiki}',
            wikiLink: wikiRuUrl,
        },
        en: {
            title: "Quick start",
            points: [
                "Create a segment",
                "Write some text in it",
                "Press the run button"
            ],
            ending: 'More information on {wiki}',
            wikiLink: wikiEnUrl,
            image: "/instructions/quick_start.png"
        },
    }
];