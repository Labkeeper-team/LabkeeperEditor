export interface TypographyProps extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    'color'
> {
    text: string;
    color?: string; //'black' | 'white';
    type?:
        'body' | 'body-large' | 'h1' | 'h2' | 'button-fullsize' | 'label-small';
    className?: string;
    style?: React.CSSProperties;
}
