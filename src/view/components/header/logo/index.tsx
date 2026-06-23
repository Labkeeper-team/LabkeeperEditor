import { LogoIcon, MiptLogo } from '../../../icons';
import { colors } from '../../../styles/colors';
import { Typography } from '../../typography';

import './style.scss';
import { BUILD_INFO } from '../../../../constants.ts';
import { useSelector } from 'react-redux';
import { useUser } from '../../../store/selectors/program.ts';
import { useIsMobile } from '../../../hooks/useMobile';

const INFO = `v${BUILD_INFO.major}${BUILD_INFO.minor ? '.' : ''}${BUILD_INFO.minor}`;

export const HeaderLogo = () => {
    const { isAuthenticated, email } = useSelector(useUser);
    const isMobile = useIsMobile();
    const miptSize = isMobile ? 22 : 32;
    const logoSize = isMobile ? 20 : 24;
    return (
        <div className="logo-container">
            {isAuthenticated && email.includes('@phystech.edu') && (
                <MiptLogo height={miptSize} width={miptSize} />
            )}
            <LogoIcon width={logoSize} height={logoSize} />
            {!isMobile ? (
                <Typography type="body-large" text="Labkeeper" />
            ) : null}
            {!isMobile ? (
                <span className="version-tooltip" data-tooltip={INFO}>
                    <Typography
                        type="body-large"
                        text={'v' + BUILD_INFO.major}
                        color={colors.gray20}
                    />
                </span>
            ) : null}
        </div>
    );
};
