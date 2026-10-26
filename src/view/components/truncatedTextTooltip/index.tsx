import { Tooltip } from 'react-tooltip';

import { isElementTextTruncated } from '../../helpers/index.ts';

/**
 * Полный текст обрезанной строки. Якорь помечается data-tooltip-id и
 * data-tooltip-content, подсказка всплывает, только если текст не влез.
 * На телефоне наведения нет, там подсказка открывается касанием
 */
export const TruncatedTextTooltip = ({
    id,
    isMobile,
}: {
    id: string;
    isMobile: boolean;
}) => (
    <Tooltip
        id={id}
        closeEvents={isMobile ? {} : { blur: true, mouseleave: true }}
        disableTooltip={(anchor) => !isElementTextTruncated(anchor)}
        globalCloseEvents={{
            clickOutsideAnchor: true,
            escape: true,
            resize: true,
            scroll: true,
        }}
        openEvents={
            isMobile ? { click: true } : { focus: true, mouseenter: true }
        }
        place="bottom"
        positionStrategy="fixed"
        variant="light"
        style={{
            maxWidth: 'min(480px, calc(100vw - 32px))',
            overflowWrap: 'anywhere',
            zIndex: 1000,
        }}
        wrapper="div"
    />
);
