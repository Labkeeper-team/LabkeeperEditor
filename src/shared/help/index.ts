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