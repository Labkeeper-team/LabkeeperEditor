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
    const selectedValue = useMemo(() => {
        return options.find(
            (o): o is SelectOption => !isSelectSeparator(o) && o.value === value
        );
    }, [value, options]);

    useLayoutEffect(() => {
        if (!fitToOptionsWidth || !widthMeasurerRef.current) {
            setOptionsWidth(undefined);
            return;
        }

        setOptionsWidth(widthMeasurerRef.current.getBoundingClientRect().width);
    }, [fitToOptionsWidth, options]);

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
            <div className="select-header" onClick={toggleDropdown}>
                <span className="selected-value">
                    {title || selectedValue?.label}
                </span>
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
