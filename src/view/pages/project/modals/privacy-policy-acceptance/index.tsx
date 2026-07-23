import { useDispatch, useSelector } from 'react-redux';
import { controller } from '../../../../../main.tsx';
import { AppDispatch, StorageState } from '../../../../store';
import { useDictionary } from '../../../../store/selectors/translations';
import { Button } from '../../../../components/button';
import { Modal } from '../../../../components/modal';
import { Typography } from '../../../../components/typography';
import { colors } from '../../../../styles/colors.ts';
import './style.scss';

export const PrivacyPolicyAcceptanceModal = () => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const showModal = useSelector(
        (state: StorageState) => state.settings.showPrivacyPolicyAcceptanceModal
    );
    const t = dictionary.privacy_policy_acceptance_modal;

    return (
        <Modal
            showModal={showModal}
            onClose={() => undefined}
            closeable={false}
        >
            <div className="privacy-policy-acceptance-modal">
                <Typography
                    text={t.title}
                    className="privacy-policy-acceptance-modal__title"
                    color={colors.gray20}
                    type="h2"
                />
                <p className="privacy-policy-acceptance-modal__description">
                    {t.description_prefix}
                    <a href="/privacy" target="_blank" rel="noreferrer">
                        {t.privacy_policy}
                    </a>
                    {t.description_middle}
                    <a href="/soglas" target="_blank" rel="noreferrer">
                        {t.personal_data_consent}
                    </a>
                    {t.description_suffix}
                </p>
                <div className="privacy-policy-acceptance-modal__actions">
                    <Button
                        title={t.accept}
                        color="blue"
                        minimize={false}
                        rounded={true}
                        onPress={() =>
                            dispatch(
                                controller.onPrivacyPolicyAcceptedRequest()
                            )
                        }
                    />
                </div>
            </div>
        </Modal>
    );
};
