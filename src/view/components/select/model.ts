import { ReactNode } from 'react';

export type SelectOption = {
    value: string | number;
    label: string;
    separator?: false;
    info?: false;
};

export type SelectSeparator = {
    separator: true;
};

export type SelectInfoItem = {
    info: true;
    label: string;
};

export type SelectItem = SelectOption | SelectSeparator | SelectInfoItem;

export interface ISelectOptions {
    options: SelectItem[];
    value: string | number;
    onChange: (value: string | number) => void;
    className?: SelectClassNames;
    containerClassName?: string;
    minimize?: boolean;
    title?: string;
    fitToOptionsWidth?: boolean;
    triggerContent?: ReactNode;
}

export enum SelectClassNames {
    Default = 'default',
    Computation = 'computation',
}
