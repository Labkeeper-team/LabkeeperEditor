import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { controller } from '../../../main.tsx';
import { AppDispatch } from '../../store';
import { useBillingPricing, useUser } from '../../store/selectors/program';
import {
    useCurrentLanguage,
    useDictionary,
} from '../../store/selectors/translations';
import { Button } from '../../components/button';
import { MarketingFooter } from '../../components/header/marketing/MarketingFooter';
import { Modal } from '../../components/modal';
import { ServicePrices } from '../../../model/rpi';
import { BillingPricingRequestState } from '../../../viewModel/repository';
import { Translations } from '../../../viewModel/dictionaries';

import './style.scss';
import {
    formatTokenPackagePrice,
    formatTokenAmount,
    mapTokenPricesToPackages,
    TOKEN_LEGAL_LINKS,
    TokenPackage,
} from './constant.ts';
import { TokensBuySection } from './TokensBuySection.tsx';
import { TokensUsageSection } from './TokensUsageSection.tsx';

const applyTokenTemplate = (template: string, tokens: string): string =>
    template.replace('{tokens}', tokens);

const getUsagePricingStatus = (
    page: Translations['tokens_page'],
    pricingRequestState: BillingPricingRequestState
): string =>
    pricingRequestState === 'loading' || pricingRequestState === 'unknown'
        ? page.pricing_loading
        : pricingRequestState === 'error'
          ? page.pricing_error
          : page.pricing_empty;

const getUsageItemsWithPrices = (
    page: Translations['tokens_page'],
    servicePrices: ServicePrices | undefined,
    pricingRequestState: BillingPricingRequestState,
    language: 'ru' | 'en'
) => {
    if (!servicePrices) {
        return page.usage_items.map((item, index) =>
            index === 0
                ? {
                      ...item,
                      rateLines: [
                          ...(item.rateLines ?? []),
                          getUsagePricingStatus(page, pricingRequestState),
                      ],
                  }
                : item
        );
    }

    const rates = page.usage_rates;
    return page.usage_items.map((item, index) => {
        if (index === 0) {
            return {
                ...item,
                rateLines: [
                    ...(item.rateLines ?? []),
                    applyTokenTemplate(
                        rates.gpt_text_prompt,
                        formatTokenAmount(
                            servicePrices.gptTextPromptTokenCost,
                            language
                        )
                    ),
                ],
            };
        }
        if (index === 1) {
            return {
                ...item,
                rateLines: [
                    ...(item.rateLines ?? []),
                    applyTokenTemplate(
                        rates.gpt_image_prompt,
                        formatTokenAmount(
                            servicePrices.gptImagePromptTokenCost,
                            language
                        )
                    ),
                ],
            };
        }
        if (index === 2) {
            return {
                ...item,
                rateLines: [
                    ...(item.rateLines ?? []),
                    applyTokenTemplate(
                        rates.latex_compilation,
                        formatTokenAmount(
                            servicePrices.latexCompilationTokenCostPerSecond,
                            language
                        )
                    ),
                    applyTokenTemplate(
                        rates.markdown_compilation,
                        formatTokenAmount(
                            servicePrices.markdownCompilationTokenCostPerSecond,
                            language
                        )
                    ),
                ],
            };
        }
        return item;
    });
};

export const TokensPage = () => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const language = useSelector(useCurrentLanguage);
    const { isAuthenticated } = useSelector(useUser);
    const { pricing, pricingRequestState } = useSelector(useBillingPricing);
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
    const tokenPackages = useMemo(
        () => mapTokenPricesToPackages(pricing?.tokenPrices),
        [pricing?.tokenPrices]
    );
    const usageItems = useMemo(
        () =>
            getUsageItemsWithPrices(
                page,
                pricing?.servicePrices,
                pricingRequestState,
                language
            ),
        [language, page, pricing?.servicePrices, pricingRequestState]
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
                    packages={tokenPackages}
                    pricingRequestState={pricingRequestState}
                    onPackageSelect={onPackageClick}
                />
                <TokensUsageSection
                    usage_title={page.usage_title}
                    usage_items={usageItems}
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
