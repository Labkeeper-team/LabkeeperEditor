import { useSelector } from 'react-redux';

import type { Translations } from '../../../viewModel/dictionaries/index.ts';
import { useUser } from '../../store/selectors/program';
import { useCurrentLanguage } from '../../store/selectors/translations.ts';
import {
    formatTokenPackagePrice,
    TOKEN_PACKAGES,
    TokenPackage,
} from './constant.ts';
import { TokenPackageCard } from './TokenPackageCard.tsx';

type TokensBuySectionProps = {
    page: Translations['tokens_page'];
    onPackageSelect: (tokenPackage: TokenPackage) => void;
};

export const TokensBuySection = ({
    page,
    onPackageSelect,
}: TokensBuySectionProps) => {
    const { isAuthenticated, tokens } = useSelector(useUser);
    const language = useSelector(useCurrentLanguage);

    return (
        <section className="tokens-page__buy-section" id="token-packages">
            <div className="tokens-page__container tokens-page__buy-section-inner">
                <div className="tokens-page__buy-intro-row">
                    <h2 className="tokens-page__buy-headline">
                        <span className="tokens-page__buy-headline-lead">
                            {page.buy_section_headline_lead}
                        </span>
                        <br />
                        <span className="tokens-page__buy-headline-rest">
                            {page.buy_section_headline_rest}
                        </span>
                    </h2>
                    <p className="tokens-page__buy-intro-text">
                        {page.buy_section_intro}
                    </p>
                </div>

                <div className="tokens-page__buy-packages-block">
                    {isAuthenticated ? (
                        <h3
                            className="tokens-page__buy-auth-balance-row"
                            role="status"
                            aria-live="polite"
                        >
                            <span className="tokens-page__buy-auth-balance-prefix">
                                {page.authenticated_buy_balance_prefix}
                            </span>
                            <span className="tokens-page__buy-auth-token-pill">
                                {tokens}
                                {'\u00A0'}
                                {page.tokens_amount}
                            </span>
                        </h3>
                    ) : (
                        <h3 className="tokens-page__buy-packages-heading">
                            {page.buy_packages_heading}
                        </h3>
                    )}
                    <div className="tokens-page__packages">
                        {TOKEN_PACKAGES.map((tokenPackage) => (
                            <TokenPackageCard
                                key={tokenPackage.key}
                                tokenPackage={tokenPackage}
                                formattedPrice={formatTokenPackagePrice(
                                    tokenPackage.price,
                                    language
                                )}
                                quantityLabel={page.package_quantity_label}
                                sublineTemplate={
                                    page.package_card_subline_template
                                }
                                tokensWord={page.tokens_amount}
                                onSelect={onPackageSelect}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};
