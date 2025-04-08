export interface CheckboxProps {
    checked: boolean;
    onChange: (newValue: boolean) => unknown;
    id: string;
    title?: string;
    className?: string;
    hidden?: boolean;
}
