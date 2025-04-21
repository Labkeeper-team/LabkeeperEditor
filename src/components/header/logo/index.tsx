import { LogoIcon, MiptLogo } from '../../../shared/icons';
import { colors } from '../../../shared/styles/colors';
import { Typography } from '../../typography';

import './style.scss';
import { BUILD_INFO } from '../../../shared/version';
import { useSelector } from 'react-redux';
import { useUser } from '../../../store/selectors/program.ts';

const INFO = `v${BUILD_INFO.major}${BUILD_INFO.minor ? '.' : ''}${BUILD_INFO.minor}`;

export const HeaderLogo = () => {
    const { isAuthenticated, email } = useSelector(useUser);
    return (
        <div className="logo-container">
            {isAuthenticated && email.includes('@phystech.edu') && <MiptLogo />}
            <LogoIcon />
            <Typography type="body-large" text="Labkeeper" />
            <span className="version-tooltip" data-tooltip={INFO}>
                <Typography
                    type="body-large"
                    text={'v' + BUILD_INFO.major}
                    color={colors.gray20}
                />
            </span>
        </div>
    );
};
