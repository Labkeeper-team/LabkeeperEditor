import {
    Key,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    ISelectOptions,
    SelectClassNames,
    SelectItem,
    SelectOption,
} from './model';
import classNames from 'classnames';

import './style.scss';
import { useHotkeys } from 'react-hotkeys-hook';

const isSelectSeparator = (option: SelectItem): option is { separator: true } =>
    option.separator === true;

const getOptionKey = (option: SelectItem, index: number): Key => {
    return isSelectSeparator(option) ? `separator-${index}` : option.value;
};

export const Select = ({
    title,
    options,
    value,
    onChange,
    className = SelectClassNames.Default,
    containerClassName,
    minimize = false,
    fitToOptionsWidth = false,
}: ISelectOptions) => {
    const [isOpen, setIsOpen] = useState(false); // Состояние открытия/закрытия списка
    const [optionsWidth, setOptionsWidth] = useState<number>();
    const selectRef = useRef<HTMLDivElement>(null); // Ссылка на контейнер
    const widthMeasurerRef = useRef<HTMLUListElement>(null);
    const titleWidthMeasurerRef = useRef<HTMLSpanElement>(null);
    const selectHeaderRef = useRef<HTMLDivElement>(null);
    const selectedValue = useMemo(() => {
        return options.find(
            (o): o is SelectOption => !isSelectSeparator(o) && o.value === value
        );
    }, [value, options]);
    const displayTitle = title || selectedValue?.label;

    useLayoutEffect(() => {
        if (
            !fitToOptionsWidth ||
            !widthMeasurerRef.current ||
            !titleWidthMeasurerRef.current ||
            !selectHeaderRef.current
        ) {
            setOptionsWidth(undefined);
            return;
        }

        const headerStyles = window.getComputedStyle(selectHeaderRef.current);
        const headerHorizontalSpacing =
            (parseFloat(headerStyles.paddingLeft) || 0) +
            (parseFloat(headerStyles.paddingRight) || 0) +
            (parseFloat(headerStyles.borderLeftWidth) || 0) +
            (parseFloat(headerStyles.borderRightWidth) || 0);
        const titleWidth =
            titleWidthMeasurerRef.current.getBoundingClientRect().width +
            headerHorizontalSpacing;

        setOptionsWidth(
            Math.max(
                widthMeasurerRef.current.getBoundingClientRect().width,
                titleWidth
            )
        );
    }, [displayTitle, fitToOptionsWidth, options]);

    // Обработчик клика по опции
    const handleOptionClick = (_value: SelectOption) => {
        setIsOpen(false); // Закрываем список
        onChange(_value.value); // Передаем выбранное значение в родительский компонент
    };

    useHotkeys(
        'esc',
        (e) => {
            e?.preventDefault();
            e?.stopPropagation();
            setIsOpen(false);
        },
        { keydown: true, enableOnContentEditable: true, enableOnFormTags: true }
    );
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                selectRef.current &&
                !selectRef.current?.contains(event.target as Node)
            ) {
                setIsOpen(false); // Закрываем список, если клик был за пределами контейнера
            }
        };

        // Добавляем обработчик события при монтировании компонента
        document.addEventListener('mousedown', handleClickOutside);

        // Удаляем обработчик события при размонтировании компонента
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Обработчик клика по заголовку
    const toggleDropdown = () => {
        setIsOpen(!isOpen); // Переключаем состояние открытия/закрытия
    };
    return (
        <div
            ref={selectRef}
            className={classNames(
                'labkeeper_select',
                className,
                containerClassName,
                {
                    open: isOpen,
                    minimize: minimize,
                    'fit-options-width': fitToOptionsWidth,
                }
            )}
            style={
                fitToOptionsWidth && optionsWidth
                    ? { width: optionsWidth }
                    : undefined
            }
        >
            {fitToOptionsWidth ? (
                <ul
                    className="select-options select-width-measurer"
                    aria-hidden
                    ref={widthMeasurerRef}
                >
                    {options.map((option, index) =>
                        isSelectSeparator(option) ? (
                            <li
                                key={getOptionKey(option, index)}
                                className="select-option-separator"
                            />
                        ) : (
                            <li
                                key={getOptionKey(option, index)}
                                className="select-width-measurer__option"
                            >
                                {option.label}
                            </li>
                        )
                    )}
                </ul>
            ) : null}
            <div
                className="select-header"
                onClick={toggleDropdown}
                ref={selectHeaderRef}
            >
                {fitToOptionsWidth ? (
                    <span
                        className="select-title-width-measurer"
                        aria-hidden
                        ref={titleWidthMeasurerRef}
                    >
                        {displayTitle}
                    </span>
                ) : null}
                <span className="selected-value">{displayTitle}</span>
            </div>
            {isOpen && (
                <ul className="select-options">
                    {options.map((option, index) =>
                        isSelectSeparator(option) ? (
                            <li
                                key={getOptionKey(option, index)}
                                className="select-option-separator"
                                role="presentation"
                            />
                        ) : (
                            <li
                                key={getOptionKey(option, index)}
                                onClick={() => handleOptionClick(option)}
                            >
                                {option.label}
                            </li>
                        )
                    )}
                </ul>
            )}
        </div>
    );
};
