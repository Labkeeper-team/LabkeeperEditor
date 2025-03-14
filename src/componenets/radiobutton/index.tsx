import classNames from 'classnames';
import { RadioProps } from './model';

import './style.scss';
import { Typography } from '../typography';
import { colors } from '../../shared/styles/colors';

export const Radio = (props: RadioProps) => {
  const onClick = () => {
    props.onChange(!props.checked);
  };
  return (
    <div
      className={classNames('labkeeper-radio', { checked: props.checked })}
      onClick={onClick}
    >
      <span className={classNames('radio-custom')}>
        {props.checked ? <div className="point" /> : null}
      </span>
      {props.title ? (
        <Typography
          color={props.checked ? colors.gray10 : colors.gray20}
          text={props.title}
        />
      ) : null}
    </div>
  );
};
