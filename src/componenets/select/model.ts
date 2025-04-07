export interface ISelectOptions {
    options: {
        label: string;
        value: unknown;
    }[];
    onChange: (value: unknown) => void;
    value: unknown;
}
