import { createPortal } from 'react-dom';
import { Tooltip, type PlacesType, type VariantType } from 'react-tooltip';

/**
 * Всплывающая подсказка. Якорь помечается data-tooltip-id и
 * data-tooltip-content. На телефоне наведения нет, там подсказка
 * открывается касанием.
 *
 * GH-254: подсказка живёт в body, а не рядом с якорем. Внутри колонки
 * редактора Safari 17 рисовал поверх неё панель агента и ручку между
 * колонками, и текст подсказки обрывался на краю колонки
 */
export const HintTooltip = ({
    id,
    isMobile,
    place = 'bottom',
    variant = 'light',
    maxWidth = 480,
    disableTooltip,
}: {
    id: string;
    isMobile: boolean;
    place?: PlacesType;
    /** светлая для тёмной шапки, тёмная поверх белого редактора */
    variant?: VariantType;
    maxWidth?: number;
    /** якорь, у которого подсказку показывать не надо */
    disableTooltip?: (anchor: Element | null) => boolean;
}) =>
    createPortal(
        <Tooltip
            id={id}
            closeEvents={isMobile ? {} : { blur: true, mouseleave: true }}
            disableTooltip={disableTooltip}
            globalCloseEvents={{
                clickOutsideAnchor: true,
                escape: true,
                resize: true,
                scroll: true,
            }}
            openEvents={
                isMobile ? { click: true } : { focus: true, mouseenter: true }
            }
            place={place}
            positionStrategy="fixed"
            variant={variant}
            style={{
                maxWidth: `min(${maxWidth}px, calc(100vw - 32px))`,
                overflowWrap: 'anywhere',
                // GH-240: подсказка лежит внутри выпадающего меню, а оно на широком
                // экране держит пункты в одну строку. Без этого текст шёл одной
                // строкой мимо maxWidth и обрезался краем экрана
                whiteSpace: 'normal',
                zIndex: 1000,
            }}
            wrapper="div"
        />,
        document.body
    );
