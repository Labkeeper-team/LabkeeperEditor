import { useMemo } from 'react';
import './style.scss';
import { Typography } from '../typography';
import { useSelector } from 'react-redux';
import { colors } from '../../shared/styles/colors';
import { useNeedLogin } from '../../store/selectors/program';
import { useDictionary } from '../../store/selectors/translations';

export const LoginModal = () => {
    const loginModalType = useSelector(useNeedLogin);
    const dictionary = useSelector(useDictionary);
    const modalText = useMemo(
        () =>
            new Map<string | boolean, string>([
                [true, dictionary.loginModal.loginToProceed],
                ['Force logout', dictionary.loginModal.description],
            ]),
        [dictionary]
    );

    return (
        <div className="login-modal">
            <Typography
                color={colors.gray10}
                text={modalText.get(loginModalType) || ''}
                type="h2"
            />
        </div>
    );
};
