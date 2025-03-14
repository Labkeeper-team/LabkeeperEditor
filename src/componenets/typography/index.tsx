import classNames from 'classnames';
import { TypographyProps } from './model';

import './style.scss';

export const Typography = (props: TypographyProps) => {
  return (
    <div
      className={classNames('typography', props.type || 'body', props.className)}
      style={{ color: props.color || 'white' }}
    >
      {props.text}
    </div>
  );
};
