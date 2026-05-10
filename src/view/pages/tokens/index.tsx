import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { controller } from '../../../main.tsx';
import { AppDispatch } from '../../store';
import { useUser } from '../../store/selectors/program';
import {
    useCurrentLanguage,
    useDictionary,
} from '../../store/selectors/translations';
import { Button } from '../../components/button';
import { MarketingFooter } from '../../components/header/marketing/MarketingFooter';
import { Modal } from '../../components/modal';

import './style.scss';
import {
    formatTokenPackagePrice,
    TOKEN_LEGAL_LINKS,
    TokenPackage,
} from './constant.ts';
import { TokensBuySection } from './TokensBuySection.tsx';
import { TokensUsageSection } from './TokensUsageSection.tsx';

export const TokensPage = () => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const language = useSelector(useCurrentLanguage);
    const { isAuthenticated } = useSelector(useUser);
    const [selectedPackage, setSelectedPackage] = useState<TokenPackage | null>(
        null
    );
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
    const [acceptedPrivacyPolicy, setAcceptedPrivacyPolicy] = useState(false);

    const page = dictionary.tokens_page;
    const canProceedToPayment = useMemo(
        () => acceptedTerms && acceptedPrivacy && acceptedPrivacyPolicy,
        [acceptedPrivacy, acceptedPrivacyPolicy, acceptedTerms]
    );

    const onPackageClick = (tokenPackage: TokenPackage) => {
        if (!isAuthenticated) {
            dispatch(controller.onAuthButtonClickedRequest());
            return;
        }

        setSelectedPackage(tokenPackage);
        setAcceptedTerms(false);
        setAcceptedPrivacy(false);
        setAcceptedPrivacyPolicy(false);
    };

    const closePurchaseModal = () => {
        setSelectedPackage(null);
    };

    return (
        <>
            <main className="tokens-page">
                <TokensBuySection
                    page={page}
                    onPackageSelect={onPackageClick}
                />
                <TokensUsageSection
                    usage_title={page.usage_title}
                    usage_items={page.usage_items}
                />
            </main>
            <MarketingFooter />

            <Modal
                showModal={Boolean(selectedPackage)}
                onClose={closePurchaseModal}
            >
                {selectedPackage ? (
                    <div className="tokens-purchase-modal">
                        <h2>{page.modal.title}</h2>
                        <div className="tokens-purchase-modal__plan">
                            <strong>
                                +{selectedPackage.amount} {page.tokens_amount}
                            </strong>
                            <span className="tokens-purchase-modal__plan-price">
                                {formatTokenPackagePrice(
                                    selectedPackage.price,
                                    language
                                )}
                            </span>
                        </div>
                        <p className="tokens-purchase-modal__gateway-notice">
                            {page.modal.gateway_notice}
                        </p>
                        <label className="tokens-purchase-modal__consent-row">
                            <input
                                type="checkbox"
                                checked={acceptedTerms}
                                onChange={(event) =>
                                    setAcceptedTerms(event.target.checked)
                                }
                            />
                            <span className="tokens-purchase-modal__consent-text">
                                {page.modal.consent_offer_prefix}
                                <a
                                    className="tokens-purchase-modal__consent-link"
                                    href={TOKEN_LEGAL_LINKS.publicOffer}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {page.modal.consent_offer_link}
                                </a>
                            </span>
                        </label>
                        <label className="tokens-purchase-modal__consent-row">
                            <input
                                type="checkbox"
                                checked={acceptedPrivacy}
                                onChange={(event) =>
                                    setAcceptedPrivacy(event.target.checked)
                                }
                            />
                            <span className="tokens-purchase-modal__consent-text">
                                {page.modal.consent_privacy_prefix}
                                <a
                                    className="tokens-purchase-modal__consent-link"
                                    href={TOKEN_LEGAL_LINKS.personalData}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {page.modal.consent_privacy_link}
                                </a>
                            </span>
                        </label>
                        <label className="tokens-purchase-modal__consent-row">
                            <input
                                type="checkbox"
                                checked={acceptedPrivacyPolicy}
                                onChange={(event) =>
                                    setAcceptedPrivacyPolicy(
                                        event.target.checked
                                    )
                                }
                            />
                            <span className="tokens-purchase-modal__consent-text">
                                {page.modal.consent_privacy_policy_prefix}
                                <a
                                    className="tokens-purchase-modal__consent-link"
                                    href={TOKEN_LEGAL_LINKS.privacyPolicy}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {page.modal.consent_privacy_policy_link}
                                </a>
                            </span>
                        </label>
                        <Button
                            title={page.modal.pay_button}
                            color="green"
                            rounded
                            minimize={false}
                            disabled={!canProceedToPayment}
                            classname="tokens-purchase-modal__button"
                        />
                        <p className="tokens-purchase-modal__notice">
                            {page.modal.mock_notice}
                        </p>
                    </div>
                ) : null}
            </Modal>
        </>
    );
};
