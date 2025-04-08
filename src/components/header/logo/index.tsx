import { LogoIcon } from '../../../shared/icons';
import { colors } from '../../../shared/styles/colors';
import { Typography } from '../../typography';

import './style.scss';

export const HeaderLogo = () => {
    return (
        <div className="logo-container">
            <LogoIcon />
            <Typography type="body-large" text="Labkeeper" />
            <Typography type="body-large" text="v2" color={colors.gray20} />
        </div>
    );
};
