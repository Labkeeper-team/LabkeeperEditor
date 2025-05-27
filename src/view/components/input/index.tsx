import classNames from 'classnames';
import { Typography } from '../typography';
import { InputProps } from './model';

import './style.scss';
import { forwardRef, LegacyRef } from 'react';
import { CloseIcon } from '../../icons';
import { colors } from '../../styles/colors';

export const Input = forwardRef((props: InputProps, ref) => {
    return (
        <div className={classNames('input-container', props.className)}>
            {props.title ? (
                <Typography
                    text={props.title}
                    color={
                        props.disabled
                            ? colors.disabledInputType
                            : colors.gray10
                    }
                />
            ) : null}
            <input
                required={props.required}
                ref={ref as LegacyRef<HTMLInputElement>}
                maxLength={60}
                value={props.value}
                id={props.id}
                name={props.name}
                type={props.type || 'text'}
                className={classNames('input-base', { error: props.error })}
                onChange={props.onChange}
                onBlur={props.onBlur}
                onKeyDown={props.onKeyDown}
                onClick={(e) => e.stopPropagation()}
                placeholder={props.placeholder}
                disabled={props.disabled}
            />
            {props.error ? (
                <div className="error-text-container">
                    <Typography color={colors.red10} text={props.error} />
                </div>
            ) : null}
            {props.onClear ? (
                <div onClick={props.onClear} className="input-delete-icon">
                    <CloseIcon />
                </div>
            ) : null}
        </div>
    );
});
