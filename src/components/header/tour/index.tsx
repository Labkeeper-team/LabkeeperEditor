import { useDispatch, useSelector } from 'react-redux';
import { InterfaceTour as InterfaceTourLogo } from '../../../shared/icons';
import { Typography } from '../../typography';

import './style.scss';
import { setTourVisibility } from '../../../store/slices/settings';
import { useDictionary } from '../../../store/selectors/translations';

export const InterfaceTour = () => {
    const dispatch = useDispatch();
    const dictionary = useSelector(useDictionary);

    const onClick = () => {
        dispatch(setTourVisibility(true));
    };

    return (
        <div onClick={onClick} className="interface_tour_container">
            <Typography
                type="body-large"
                text={dictionary.interface_tour.label}
            />
            <InterfaceTourLogo />
        </div>
    );
};
