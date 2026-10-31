import { isElementTextTruncated } from '../../helpers/index.ts';
import { HintTooltip } from '../hintTooltip';

/** Полный текст обрезанной строки: подсказка всплывает, только если текст не влез */
export const TruncatedTextTooltip = ({
    id,
    isMobile,
}: {
    id: string;
    isMobile: boolean;
}) => (
    <HintTooltip
        id={id}
        isMobile={isMobile}
        disableTooltip={(anchor) => !isElementTextTruncated(anchor)}
    />
);
