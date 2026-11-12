import { Typography } from '../../../components/typography';
import { colors } from '../../../styles/colors.ts';
import { WarningIcon } from '../../../icons';

export const AuthErrorMessage = ({
    text,
    centered = false,
}: {
    text: string;
    centered?: boolean;
}) => (
    <div
        style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: centered ? 'center' : undefined,
            gap: 8,
        }}
    >
        <WarningIcon style={{ flexShrink: 0 }} />
        <Typography
            color={colors.red10}
            type="body"
            text={text}
            style={{ fontWeight: 600 }}
        />
    </div>
);
