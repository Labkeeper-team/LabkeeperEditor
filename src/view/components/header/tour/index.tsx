import { useDispatch, useSelector } from 'react-redux';
import { InterfaceTour as InterfaceTourLogo } from '../../../icons';
import { Typography } from '../../typography';

import './style.scss';
import { setTourVisibility } from '../../../../viewModel/store/slices/settings';
import { useDictionary } from '../../../../viewModel/store/selectors/translations';
import { useUser } from '../../../../viewModel/store/selectors/program';
import classNames from 'classnames';

export const InterfaceTour = () => {
    const dispatch = useDispatch();
    const dictionary = useSelector(useDictionary);
    const { isAuthenticated } = useSelector(useUser);

    const onClick = () => {
        dispatch(setTourVisibility(true));
    };

    return (
        <div onClick={onClick} className="interface_tour_container">
            <Typography
                className={classNames({ 'mobile-hidden': isAuthenticated })}
                type="body-large"
                text={dictionary.interface_tour.label}
            />
            <InterfaceTourLogo />
        </div>
    );
};
