import classNames from 'classnames';
import { TypographyProps } from './model';

import './style.scss';

export const Typography = (props: TypographyProps) => {
    const { className, color, style, text, type, ...htmlProps } = props;

    return (
        <div
            {...htmlProps}
            className={classNames('typography', type || 'body', className)}
            style={{ color: color || 'white', ...style }}
        >
            {text}
        </div>
    );
};
