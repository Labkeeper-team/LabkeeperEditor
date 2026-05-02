export type SelectOption = {
    value: string | number;
    label: string;
    separator?: false;
};

export type SelectSeparator = {
    separator: true;
};

export type SelectItem = SelectOption | SelectSeparator;

export interface ISelectOptions {
    options: SelectItem[];
    value: string | number;
    onChange: (value: string | number) => void;
    className?: SelectClassNames;
    containerClassName?: string;
    minimize?: boolean;
    title?: string;
    fitToOptionsWidth?: boolean;
}

export enum SelectClassNames {
    Default = 'default',
    Computation = 'computation',
}
