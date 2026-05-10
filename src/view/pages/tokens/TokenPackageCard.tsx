import { RightArrowIcon } from '../../icons';

import { TokenPackage } from './constant.ts';

import './TokenPackageCard.scss';

type TokenPackageCardProps = {
    tokenPackage: TokenPackage;
    formattedPrice: string;
    quantityLabel: string;
    sublineTemplate: string;
    tokensWord: string;
    onSelect: (tokenPackage: TokenPackage) => void;
};

export const TokenPackageCard = ({
    tokenPackage,
    formattedPrice,
    quantityLabel,
    sublineTemplate,
    tokensWord,
    onSelect,
}: TokenPackageCardProps) => {
    const subline = sublineTemplate
        .replace('{quantity}', quantityLabel)
        .replace('{tokens}', tokensWord)
        .replace('{price}', formattedPrice);

    return (
        <article
            className={'tokens-page__package-card'}
            onClick={() => onSelect(tokenPackage)}
        >
            <div className="tokens-page__package-card-inner">
                <span className="tokens-page__package-plus">
                    +{tokenPackage.amount}
                </span>
                <p className="tokens-page__package-subline">{subline}</p>
            </div>
            <RightArrowIcon
                className="tokens-page__package-card-arrow"
                aria-hidden
            />
        </article>
    );
};
