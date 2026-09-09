import classNames from 'classnames';
import './style.scss';

export interface SegmentedControlOption<T> {
    value: T;
    label: string;
}

interface Props<T> {
    options: SegmentedControlOption<T>[];
    value: T;
    onChange: (value: T) => void;
    disabled?: boolean;
    ariaLabel?: string;
}

/** Переключатель из нескольких значений. В макете это «кнопки» под полем промпта. */
export const SegmentedControl = <T extends string | number>({
    options,
    value,
    onChange,
    disabled,
    ariaLabel,
}: Props<T>) => {
    return (
        <div className="segmented-control" role="group" aria-label={ariaLabel}>
            {options.map((option) => (
                <button
                    key={String(option.value)}
                    type="button"
                    disabled={disabled}
                    aria-pressed={option.value === value}
                    className={classNames('segmented-control__item', {
                        'segmented-control__item--active':
                            option.value === value,
                    })}
                    onClick={() => onChange(option.value)}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
};
