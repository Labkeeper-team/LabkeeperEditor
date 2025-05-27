import { ChangeEvent, FocusEvent, KeyboardEvent, MouseEvent } from 'react';

export interface InputProps {
    disabled?: boolean;
    error?: string;
    value?: string;
    name?: string;
    id?: string;
    onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
    onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
    onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
    title?: string;
    required?: boolean;
    placeholder?: string;
    className?: string;
    onClear?: (e: MouseEvent<HTMLInputElement>) => void;
    type?: 'text' | 'password';
}
