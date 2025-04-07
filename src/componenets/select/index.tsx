import { useEffect, useMemo, useRef, useState } from 'react';
import { ISelectOptions } from './model';

import './style.scss';
import { useHotkeys } from 'react-hotkeys-hook';

export const Select = ({ options, value, onChange }: ISelectOptions) => {
    const [isOpen, setIsOpen] = useState(false); // Состояние открытия/закрытия списка
    const selectRef = useRef<HTMLDivElement>(null); // Ссылка на контейнер
    const selectedValue = useMemo(() => {
        return options.find((o) => o.value === value);
    }, [value, options]);

    // Обработчик клика по опции
    const handleOptionClick = (_value) => {
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
                !selectRef.current.contains(event.target as Node)
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
            className={`labkeeper_select ${isOpen ? 'open' : ''}`}
        >
            <div className="select-header" onClick={toggleDropdown}>
                <span className="selected-value">{selectedValue?.label}</span>
            </div>
            {isOpen && (
                <ul className="select-options">
                    {options.map((option) => (
                        <li
                            key={option.value}
                            onClick={() => handleOptionClick(option)}
                        >
                            {option.label}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};
