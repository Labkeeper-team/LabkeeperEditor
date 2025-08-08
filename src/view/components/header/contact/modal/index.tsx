import { useDispatch, useSelector } from 'react-redux';
import { Modal } from '../../../modal';
import { Typography } from '../../../typography';
import { Input } from '../../../input';
import { Button } from '../../../button';
import './style.scss';
import { AppDispatch, StorageState } from '../../../../../viewModel/store';
import { useDictionary } from '../../../../../viewModel/store/selectors/translations';
import { setShowContactModal } from '../../../../../viewModel/store/slices/settings';
import { useState } from 'react';
import { onContactUsFormSubmittedRequest } from '../../../../../controller';
import { colors } from '../../../../styles/colors.ts';
import { useUser } from '../../../../../viewModel/store/selectors/program.ts';

const contactEmail = 'contact@labkeeper.io';

export const ContactModal = () => {
    const dispatch = useDispatch<AppDispatch>();
    const showModal = useSelector(
        (state: StorageState) => state.settings.showContactModal
    );
    const { isAuthenticated } = useSelector(useUser);
    const dictionary = useSelector(useDictionary);

    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');

    const t = dictionary.contact_modal;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        dispatch(
            onContactUsFormSubmittedRequest({ body: message, subject: subject })
        );
        setMessage('');
        setSubject('');
    };

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
                            <div className="contact-modal__actions">
                                <Button
                                    title={t.send}
                                    color="blue"
                                    minimize={false}
                                    rounded={true}
                                    buttonType="submit"
                                    disabled={!subject || !message}
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
