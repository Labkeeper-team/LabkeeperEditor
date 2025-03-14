export interface RadioProps {
  checked: boolean;
  onChange: (newValue: boolean) => any;
  id: string;
  title?: string;
}
