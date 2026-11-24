import { useCallback, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { controller } from '../../../main.tsx';
import { Events } from '../../../model/service/ObserverService.ts';
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
import {
    Language,
    TokenUsageKey,
    Translations,
} from '../../../viewModel/dictionaries';

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

const applySecondsTemplate = (template: string, seconds: number): string =>
    template.replace('{seconds}', String(seconds));

/** Строки тарифа под каждым разделом. Поля, которого сервер не прислал, на странице нет */
const usageRateLines = (
    rates: Translations['tokens_page']['usage_rates'],
    prices: ServicePrices,
    language: Language
): Record<TokenUsageKey, string[]> => {
    const tokens = (template: string, amount: number | undefined) =>
        typeof amount === 'number'
            ? [
                  applyTokenTemplate(
                      template,
                      formatTokenAmount(amount, language)
                  ),
              ]
            : [];
    return {
        agent: tokens(rates.gpt_text_prompt, prices.gptTextPromptTokenCost),
        compilation: [
            ...tokens(
                rates.latex_compilation,
                prices.latexCompilationTokenCostPerSecond
            ),
            ...tokens(
                rates.markdown_compilation,
                prices.markdownCompilationTokenCostPerSecond
            ),
        ],
        // GH-280: картинки и сканы, которые агент распознаёт, и голосовой ввод
        images: tokens(
            rates.text_recognition,
            prices.textRecognitionTokenCostPerPage
        ),
        voice: [
            ...tokens(
                rates.speech_recognition,
                prices.speechRecognitionTokenCostPer15Seconds
            ),
            ...(typeof prices.speechRecognitionMaxDurationSeconds === 'number'
                ? [
                      applySecondsTemplate(
                          rates.speech_max_duration,
                          prices.speechRecognitionMaxDurationSeconds
                      ),
                  ]
                : []),
        ],
    };
};

const getUsageItemsWithPrices = (
    page: Translations['tokens_page'],
    servicePrices: ServicePrices | undefined,
    pricingRequestState: BillingPricingRequestState,
    language: Language
) => {
    if (!servicePrices) {
        // пока цен нет, под первым разделом сказано, что с ними
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

    const lines = usageRateLines(page.usage_rates, servicePrices, language);
    return page.usage_items.map((item) => ({
        ...item,
        rateLines: [...(item.rateLines ?? []), ...lines[item.key]],
    }));
};

export const TokensPage = () => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const language = useSelector(useCurrentLanguage);
    const { isAuthenticated } = useSelector(useUser);
    const { pricing, pricingRequestState, purchaseRequestState } =
        useSelector(useBillingPricing);
    const [selectedPackage, setSelectedPackage] = useState<TokenPackage | null>(
        null
    );
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
    const [acceptedPrivacyPolicy, setAcceptedPrivacyPolicy] = useState(false);
    const page = dictionary.tokens_page;
    const canProceedToPayment = useMemo(
        () =>
            acceptedTerms &&
            acceptedPrivacy &&
            acceptedPrivacyPolicy &&
            purchaseRequestState !== 'loading',
        [
            acceptedPrivacy,
            acceptedPrivacyPolicy,
            acceptedTerms,
            purchaseRequestState,
        ]
    );
    const tokenPackages = useMemo(
        () => mapTokenPricesToPackages(pricing?.tokenPrices),
        [pricing?.tokenPrices]
    );
    const freeBenefits =
        pricingRequestState === 'ok' &&
        pricing != null &&
        typeof pricing.newUserInitialTokensCount === 'number' &&
        pricing.userRegularRefill != null
            ? {
                  initialTokensCount: pricing.newUserInitialTokensCount,
                  refillTokensAmount:
                      pricing.userRegularRefill.refillTokensAmount,
                  refillPeriodSeconds:
                      pricing.userRegularRefill.refillPeriodSeconds,
              }
            : undefined;
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
        controller.trackUiEvent(Events.EVENT_TOKEN_PACKAGE_SELECTED, {
            token_price_id: tokenPackage.tokenPriceId,
            amount: tokenPackage.amount,
            price: tokenPackage.price,
        });
        if (!isAuthenticated) {
            dispatch(controller.onAuthButtonClickedRequest('tokens'));
            return;
        }

        setSelectedPackage(tokenPackage);
        setAcceptedTerms(false);
        setAcceptedPrivacy(false);
        setAcceptedPrivacyPolicy(false);
        dispatch(controller.onBillingPurchaseFlowResetRequest());
    };

    const closePurchaseModal = useCallback(() => {
        setSelectedPackage(null);
        dispatch(controller.onBillingPurchaseFlowResetRequest());
    }, [dispatch]);

    const onPaymentButtonPress = useCallback(() => {
        if (!selectedPackage || purchaseRequestState === 'loading') {
            return;
        }

        dispatch(
            controller.onBillingPurchaseCreateRequest({
                tokenPriceId: selectedPackage.tokenPriceId,
            })
        );
    }, [dispatch, purchaseRequestState, selectedPackage]);

    const purchaseStatusMessage =
        purchaseRequestState === 'loading'
            ? page.modal.payment_loading
            : purchaseRequestState === 'error'
              ? page.modal.payment_error
              : null;

    return (
        <>
            <main className="tokens-page">
                <TokensBuySection
                    page={page}
                    packages={tokenPackages}
                    pricingRequestState={pricingRequestState}
                    freeBenefits={freeBenefits}
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
                            onPress={onPaymentButtonPress}
                            classname="tokens-purchase-modal__button"
                        />
                        {purchaseStatusMessage ? (
                            <p className="tokens-purchase-modal__notice">
                                {purchaseStatusMessage}
                            </p>
                        ) : null}
                    </div>
                ) : null}
            </Modal>
        </>
    );
};
