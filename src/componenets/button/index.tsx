import classNames from 'classnames';
import { ButtnProps } from './model';

import './style.scss';

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
      disabled={props.disabled}
      onClick={props.onPress}
    >
      {props.title}
      {props.titleIcon ? props.titleIcon() : null}
    </button>
  );
};
