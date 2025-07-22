import classNames from 'classnames';
import { ButtnProps } from './model';

import './style.scss';
import { ReactNode } from 'react';

export const Button = (props: ButtnProps) => {
    return (
        <button
            type={props.buttonType || 'button'}
            className={classNames(
                'labkeeper-button',
                `${props.color || 'inherit'}-color`,
                props.classname,
                {
                    minimize: props.minimize,
                    rounded: props.rounded,
                    disabled: props.disabled,
                }
            )}
            style={props.style}
            disabled={props.disabled}
            onClick={props.onPress}
        >
            <span style={{ overflow: 'hidden' }}>{props.title}</span>
            {props.titleIcon ? (props.titleIcon() as ReactNode) : null}
        </button>
    );
};
