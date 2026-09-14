export interface SectorHeaderProps {
    title: React.ReactNode | string;
    onPressExpanded: () => void;
    expanded: boolean;
    /** Кнопки справа от заголовка, их нажатие не сворачивает секцию */
    actions?: React.ReactNode;
}
