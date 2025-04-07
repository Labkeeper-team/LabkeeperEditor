import { ChangeEvent } from 'react';

export interface InputProps {
    disabled?: boolean;
    error?: string;
    value?: string;
    name?: string;
    id?: string;
    onChange?: (e: ChangeEvent<HTMLInputElement>) => unknown;
    onBlur?: (e: unknown) => unknown;
    onKeyDown?: (e: unknown) => unknown;
    title?: string;
    required?: boolean;
    placeholder?: string;
    className?: string;
    onClear?: (e) => void;
    type?: 'text' | 'password';
}
