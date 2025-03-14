export interface ISelectOptions {
    options: {
        label: string;
        value: any;
    }[];
    onChange: (value: any) => void;
    value: any;
}