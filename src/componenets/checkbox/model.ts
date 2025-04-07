export interface CheckboxProps {
  checked: boolean;
  onChange: (newValue: boolean) => any;
  id: string;
  title?: string;
  className?: string;
  hidden?: boolean;
}
