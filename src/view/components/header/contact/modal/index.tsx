import { useDispatch, useSelector } from 'react-redux';
import { Modal } from '../../../modal';
import { Typography } from '../../../typography';
import { Input } from '../../../input';
import { Button } from '../../../button';
import './style.scss';
import { AppDispatch, StorageState } from '../../../../store';
import { useDictionary } from '../../../../store/selectors/translations';
import { setShowContactModal } from '../../../../store/slices/settings';
import { useState } from 'react';
import { colors } from '../../../../styles/colors.ts';
import { useUser } from '../../../../store/selectors/program.ts';
import { controller } from '../../../../../main.tsx';

const contactEmail = 'labkeeper.io@gmail.com';

export const ContactModal = () => {
    const dispatch = useDispatch<AppDispatch>();
    const showModal = useSelector(
        (state: StorageState) => state.settings.showContactModal
    );
    const { isAuthenticated } = useSelector(useUser);
    const dictionary = useSelector(useDictionary);

    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [agreementAccepted, setAgreementAccepted] = useState(false);

    const t = dictionary.contact_modal;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        dispatch(
            controller.onContactUsFormSubmittedRequest({
                body: message,
                subject: subject,
            })
        );
        setMessage('');
        setSubject('');
        setAgreementAccepted(false);
    };

    const agreementText = (
        <>
            {t.agreement_prefix} <a href="/privacy">{t.privacy_policy}</a>{' '}
            {t.agreement_and} <a href="/soglas">{t.personal_data_consent}</a>
        </>
    );

    const agreement = (
        <p className="contact-modal__agreement">{agreementText}</p>
    );

    return (
        <Modal
            showModal={showModal}
            onClose={() => dispatch(setShowContactModal(false))}
        >
            <div className="contact-modal">
                <Typography
                    text={t.contact_email}
                    className="contact-modal__title"
                    color={colors.gray20}
                    type={'h2'}
                />
                <a>{contactEmail}</a>
                {!isAuthenticated && agreement}
                {isAuthenticated && (
                    <>
                        <br />
                        <br />
                        <Typography
                            text={t.contact_form}
                            className="contact-modal__title"
                            color={colors.gray20}
                            type={'h2'}
                        />
                        <form
                            onSubmit={handleSubmit}
                            className="contact-modal__form"
                        >
                            <Input
                                title={t.subject}
                                placeholder={t.subject_placeholder}
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                            />
                            <div className="textarea-container">
                                <label>{t.message}</label>
                                <textarea
                                    maxLength={2000}
                                    placeholder={t.message_placeholder}
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                />
                            </div>
                            <label className="contact-modal__agreement-checkbox">
                                <input
                                    type="checkbox"
                                    checked={agreementAccepted}
                                    onChange={(e) =>
                                        setAgreementAccepted(e.target.checked)
                                    }
                                />
                                <span>{agreementText}</span>
                            </label>
                            <div className="contact-modal__actions">
                                <Button
                                    title={t.send}
                                    color="blue"
                                    minimize={false}
                                    rounded={true}
                                    buttonType="submit"
                                    disabled={
                                        !subject ||
                                        !message ||
                                        !agreementAccepted
                                    }
                                />
                                <Button
                                    title={t.cancel}
                                    color="gray"
                                    minimize={false}
                                    rounded={true}
                                    onPress={() =>
                                        dispatch(setShowContactModal(false))
                                    }
                                />
                            </div>
                        </form>
                    </>
                )}
            </div>
        </Modal>
    );
};
