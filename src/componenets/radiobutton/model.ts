export interface RadioProps {
    checked: boolean;
    onChange: (newValue: boolean) => unknown;
    id: string;
    title?: string;
}
