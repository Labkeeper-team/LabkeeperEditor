import { LogoIcon, MiptLogo } from '../../../icons';
import { colors } from '../../../styles/colors';
import { Typography } from '../../typography';

import './style.scss';
import { BUILD_INFO } from '../../../../constants.ts';
import { useSelector } from 'react-redux';
import { useUser } from '../../../../viewModel/store/selectors/program.ts';

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
