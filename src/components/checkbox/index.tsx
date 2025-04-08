import classNames from 'classnames';
import { CheckIcon } from '../../shared/icons';
import { CheckboxProps } from './model';

import './style.scss';
import { Typography } from '../typography';
import { colors } from '../../shared/styles/colors';

export const Checkbox = (props: CheckboxProps) => {
    const onClick = () => {
        props.onChange(!props.checked);
    };
    if (props.hidden) {
        return <></>;
    }
    return (
        <div
            className={classNames(
                'labkeeper-checkbox',
                { checked: props.checked },
                props.className
            )}
            onClick={onClick}
        >
            <span className={classNames('checbox-custom')}>
                {props.checked ? <CheckIcon /> : null}
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
