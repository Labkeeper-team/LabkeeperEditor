import type { Translations } from '../../../viewModel/dictionaries/index.ts';
import { formatRefillPeriod, formatTokenNumber } from './constant.ts';

type TokensFreeBenefitsProps = {
    page: Translations['tokens_page'];
    language: 'ru' | 'en';
    initialTokensCount: number;
    refillTokensAmount: number;
    refillPeriodSeconds: number;
};

export const TokensFreeBenefits = ({
    page,
    language,
    initialTokensCount,
    refillTokensAmount,
    refillPeriodSeconds,
}: TokensFreeBenefitsProps) => {
    const free = page.free_benefits;
    const refillCaption = free.refill_caption.replace(
        '{period}',
        formatRefillPeriod(refillPeriodSeconds, language)
    );

    return (
        <div className="tokens-page__free-benefits">
            <div className="tokens-page__free-benefit">
                <p className="tokens-page__free-benefit-label">
                    {free.initial_label}
                </p>
                <p className="tokens-page__free-benefit-value">
                    <span className="tokens-page__free-benefit-amount">
                        {formatTokenNumber(initialTokensCount, language)}
                    </span>
                    <span className="tokens-page__free-benefit-unit">
                        {page.tokens_amount}
                    </span>
                </p>
                <p className="tokens-page__free-benefit-caption">
                    {free.initial_caption}
                </p>
            </div>

            <div
                className="tokens-page__free-benefits-divider"
                aria-hidden="true"
            />

            <div className="tokens-page__free-benefit">
                <p className="tokens-page__free-benefit-label">
                    {free.refill_label}
                </p>
                <p className="tokens-page__free-benefit-value">
                    <span className="tokens-page__free-benefit-amount">
                        {formatTokenNumber(refillTokensAmount, language)}
                    </span>
                    <span className="tokens-page__free-benefit-unit">
                        {page.tokens_amount}
                    </span>
                </p>
                <p className="tokens-page__free-benefit-caption">
                    {refillCaption}
                </p>
            </div>
        </div>
    );
};
