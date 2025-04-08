export interface ISelectOptions {
    options: Array<{ value: string | number; label: string }>;
    value: string | number;
    onChange: (value: string | number) => void;
    className?: SelectClassNames;
}

export enum SelectClassNames {
    Default = 'default',
    Computation = 'computation'
}
