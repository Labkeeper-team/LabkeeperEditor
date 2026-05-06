import type { Translations } from '../../../viewModel/dictionaries/index.ts';

type TokensUsageSectionProps = Pick<
    Translations['tokens_page'],
    'usage_title' | 'usage_items'
>;

export const TokensUsageSection = ({
    usage_title,
    usage_items,
}: TokensUsageSectionProps) => (
    <section className="tokens-page__usage">
        <div className="tokens-page__container">
            <div className="tokens-page__usage-grid">
                <div className="tokens-page__usage-heading">
                    <h2>{usage_title}</h2>
                </div>
                <ul className="tokens-page__usage-list">
                    {usage_items.map((item, index) => (
                        <li
                            key={`usage-${index}`}
                            className="tokens-page__usage-item"
                        >
                            <div className="tokens-page__usage-item-inner">
                                <p className="tokens-page__usage-item-heading">
                                    {item.heading}
                                </p>
                                {item.body ? (
                                    <p className="tokens-page__usage-item-body">
                                        {item.body}
                                    </p>
                                ) : null}
                                {item.rateLines?.length ? (
                                    <div className="tokens-page__usage-item-rates">
                                        {item.rateLines.map(
                                            (line, rateIndex) => (
                                                <p
                                                    key={`${index}-${rateIndex}`}
                                                    className="tokens-page__usage-item-heading"
                                                >
                                                    {line}
                                                </p>
                                            )
                                        )}
                                    </div>
                                ) : null}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    </section>
);
