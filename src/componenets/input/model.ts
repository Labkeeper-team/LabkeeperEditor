import { ChangeEvent } from 'react';

export interface InputProps {
  disabled?: boolean;
  error?: string;
  value?: string;
  name?: string;
  id?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => any;
  onBlur?: (e: any) => any;
  onKeyDown?: (e: any) => any;
  title?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  onClear?: (e) => void;
  type?: 'text' | 'password';
}
