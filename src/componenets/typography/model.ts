export interface TypographyProps {
    text: string;
    color?: string; //'black' | 'white';
    type?:
        | 'body'
        | 'body-large'
        | 'h1'
        | 'h2'
        | 'button-fullsize'
        | 'label-small';
    className?: string;
    style?: React.CSSProperties;
}
