import classNames from 'classnames';
import { Typography } from '../typography';
import { InputProps } from './model';

import './style.scss';
import { forwardRef, LegacyRef } from 'react';
import { CloseIcon } from '../../icons';
import { colors } from '../../styles/colors';

export const Input = forwardRef((props: InputProps, ref) => {
    const maxLength = props.maxLength ?? 60;

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
            {props.multiline ? (
                <textarea
                    ref={ref as LegacyRef<HTMLTextAreaElement>}
                    value={props.value}
                    id={props.id}
                    name={props.name}
                    rows={props.rows ?? 5}
                    className={classNames(
                        'input-base',
                        'input-base--textarea',
                        { error: props.error }
                    )}
                    onChange={props.onChange}
                    onBlur={props.onBlur}
                    onKeyDown={props.onKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    placeholder={props.placeholder}
                    disabled={props.disabled}
                    maxLength={props.maxLength}
                />
            ) : (
                <input
                    required={props.required}
                    ref={ref as LegacyRef<HTMLInputElement>}
                    maxLength={maxLength}
                    value={props.value}
                    id={props.id}
                    name={props.name}
                    type={props.type || 'text'}
                    className={classNames('input-base', { error: props.error })}
                    onChange={props.onChange}
                    onBlur={props.onBlur}
                    onKeyDown={props.onKeyDown}
                    enterKeyHint={props.enterKeyHint}
                    onClick={(e) => e.stopPropagation()}
                    placeholder={props.placeholder}
                    disabled={props.disabled}
                />
            )}
            {props.error || props.showCharacterCount ? (
                <div className="input-hint">
                    {!props.error && props.showCharacterCount ? (
                        <Typography
                            className="input-character-count"
                            color={colors.gray30}
                            type="label-small"
                            text={`${props.value?.length ?? 0} / ${maxLength}`}
                        />
                    ) : null}
                    {props.error ? (
                        <div className="error-text-container">
                            <Typography
                                color={colors.red10}
                                text={props.error}
                            />
                        </div>
                    ) : null}
                </div>
            ) : null}
            {props.onClear && !props.multiline ? (
                <div onClick={props.onClear} className="input-delete-icon">
                    <CloseIcon />
                </div>
            ) : null}
        </div>
    );
});
