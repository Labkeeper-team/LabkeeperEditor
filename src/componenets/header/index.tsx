import { useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { Typography } from '../typography';
import { Button } from '../button';

import { HeaderLogo } from './logo';
import { InterfaceTour } from './tour';
import './style.scss';

import { Back } from './back';
import { useLocation } from 'react-router-dom';
import { useUser } from '../../store/selectors/program';
import {Routes} from "../../routing/routes.ts";
import { useCurrentLanguge, useDictionary } from '../../store/selectors/translations';
import { setLanguage } from '../../store/slices/settings';
import { Select } from '../select';
import { ProjectTitle } from './projectTitle';
import { Modal } from '../../shared/components/modal';
import { colors } from '../../shared/styles/colors';
import { Login1Icon, Login2Icon } from '../../shared/icons';
import { Language } from '../../store/shared/dictionaries';

const languageOptions = [
  {
    label: 'English',
    value: 'en',
  },
  {
    label: 'Русский',
    value: 'ru'
  }
];

export const Header = () => {
  const dispatch = useDispatch();
  const [showAuthModal, setShowAuthModal ] = useState(false);
  const location = useLocation();
  const dictionary = useSelector(useDictionary);
  const language = useSelector(useCurrentLanguge);
  const { isAuthenticated, email } = useSelector(useUser);

  const onLoginClick = useCallback(async () => {
    setShowAuthModal(true);
  }, []);

  const onPressYandexAuthClick = async () => {
    window.location = Routes.Login as any;
  }

  const onPressSimpleAuthClick = async () => {
    window.location = Routes.Login as any;
  }

  const onPress = (lang: Language) => {
    dispatch(setLanguage(lang))
  }

  return (
    <>
    <div className="labkeeper_header">
      <div className="labkeeper_header__left">
        {isAuthenticated && location.pathname.startsWith('/project/') ? <Back /> : null}
        <HeaderLogo />
        <div style={{marginLeft:20}}>
        <Select
          options={languageOptions}
          onChange={onPress}
          value={language}
        />
        </div>
      </div>
      <ProjectTitle />
      <div className="labkeeper_header__right">
        {location.pathname.startsWith('/project/') ? <InterfaceTour /> : null}
        {!isAuthenticated ? (
          <Button
            title={dictionary.login}
            rounded
            classname='login-button'
            onPress={onLoginClick}
            minimize
            color="inherit"
          />
        ) : null}
        {isAuthenticated ? (
          <Typography color="white" text={email} />
        ) : null}
        {isAuthenticated ? (
            <form method="POST" action={Routes.Logout}>
                <Button
                    title={dictionary.exit}
                    rounded
                    classname='exit-button'
                    minimize
                    buttonType="submit"
                    color="inherit"
                />
            </form>
        ) : null}
      </div>
    </div>
    <Modal showModal={showAuthModal} onClose={() => setShowAuthModal(false)}>
      <div className='auth-modal' style={{display: 'flex', flexDirection: 'column', padding: '30px 40px'}}>
          <Typography className='auth-header' color={colors.gray10} type='h2' text={dictionary.authorization.title} />
          <div style={{display: 'flex', flexDirection: 'column', gap: 8, marginTop: 28, justifyContent: 'center', alignItems: 'center'}}>
            <Button classname='full-width ' title={`${dictionary.authorization.loginVia} @phystech.edu`} color='blue' rounded type='rounded' titleIcon={Login2Icon} minimize={false} onPress={onPressYandexAuthClick} />
            <Typography color={colors.gray10} type='body-large' text={dictionary.or} />
            <Button classname='full-width ' title={dictionary.authorization.loginAndPasswoord}  color='blue' rounded type='rounded' titleIcon={Login1Icon} minimize={false} onPress={onPressSimpleAuthClick}/>
          </div>
      </div>
    </Modal>
    </>
  );
};
