import { useState, useEffect } from 'react';

// мышь или тачпад есть хотя бы у одного устройства ввода, как у ноутбука с сенсорным экраном
const FINE_POINTER_QUERY = '(any-pointer: fine)';

/** Телефонам и планшетам без мыши тонкие ручки ни к чему, а мышь можно подключить на ходу */
export const useHasFinePointer = () => {
    const [hasFinePointer, setHasFinePointer] = useState(
        () => window.matchMedia(FINE_POINTER_QUERY).matches
    );

    useEffect(() => {
        const query = window.matchMedia(FINE_POINTER_QUERY);
        const handleChange = () => {
            setHasFinePointer(query.matches);
        };

        query.addEventListener('change', handleChange);

        handleChange();

        return () => {
            query.removeEventListener('change', handleChange);
        };
    }, []);

    return hasFinePointer;
};
