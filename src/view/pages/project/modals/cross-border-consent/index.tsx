import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { controller } from '../../../../../main.tsx';
import { AppDispatch, StorageState } from '../../../../store';
import { useDictionary } from '../../../../store/selectors/translations';
import { Button } from '../../../../components/button';
import { Modal } from '../../../../components/modal';
import { Typography } from '../../../../components/typography';
import { colors } from '../../../../styles/colors.ts';
import './style.scss';

/** Документ с условиями трансграничной передачи, адрес дал заказчик */
const CONSENT_DOCUMENT_URL = 'https://labkeeper.io/sogl_ds';

export const CrossBorderConsentModal = () => {
    const showModal = useSelector(
        (state: StorageState) => state.settings.showCrossBorderConsentModal
    );

    // содержимое живёт ровно столько, сколько видно окно: иначе снятая галка
    // осталась бы отмеченной со прошлого раза
    if (!showModal) {
        return null;
    }
    return <CrossBorderConsentDialog />;
};

const CrossBorderConsentDialog = () => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const [checked, setChecked] = useState(false);
    const t = dictionary.cross_border_consent_modal;

    const close = () =>
        dispatch(controller.onCrossBorderConsentDismissedRequest());

    return (
        <Modal showModal={true} onClose={close}>
            <div className="cross-border-consent-modal">
                <Typography
                    text={t.title}
                    className="cross-border-consent-modal__title"
                    color={colors.gray20}
                    type="h2"
                />
                <label className="cross-border-consent-modal__consent-row">
                    <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => setChecked(event.target.checked)}
                    />
                    <span className="cross-border-consent-modal__consent-text">
                        {t.consent_prefix}
                        <a
                            className="cross-border-consent-modal__consent-link"
                            href={CONSENT_DOCUMENT_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(event) => event.stopPropagation()}
                        >
                            {t.consent_link}
                        </a>
                        {t.consent_suffix}
                    </span>
                </label>
                <div className="cross-border-consent-modal__actions">
                    <Button
                        title={t.cancel}
                        color="gray"
                        minimize={false}
                        rounded={true}
                        onPress={close}
                    />
                    <Button
                        title={t.accept}
                        color="blue"
                        minimize={false}
                        rounded={true}
                        disabled={!checked}
                        onPress={() =>
                            dispatch(
                                controller.onCrossBorderConsentAcceptedRequest()
                            )
                        }
                    />
                </div>
            </div>
        </Modal>
    );
};
