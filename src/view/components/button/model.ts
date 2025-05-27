import { MouseEvent } from 'react';

export interface ButtnProps {
    onPress?: (e?: MouseEvent<HTMLButtonElement>) => void;
    classname?: string;
    title: string;
    titleIcon?: () => unknown;
    minimize: boolean | 'super';
    rounded?: boolean;
    disabled?: boolean;
    color: 'green' | 'blue' | 'gray' | 'inherit';
    type?: 'rounded';
    buttonType?: 'submit' | 'reset';
}
