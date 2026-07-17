import { TokenPrice } from '../../../model/rpi';

export type TokenPackage = {
    key: string;
    amount: number;
    price: number;
};

export const formatTokenPackagePrice = (
    price: number,
    language: 'ru' | 'en'
): string =>
    new Intl.NumberFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
        style: 'currency',
        currency: 'RUB',
        maximumFractionDigits: 0,
    }).format(price);

export const formatTokenAmount = (
    amount: number,
    language: 'ru' | 'en'
): string => {
    const formattedAmount = new Intl.NumberFormat(
        language === 'ru' ? 'ru-RU' : 'en-US',
        { maximumFractionDigits: 2 }
    ).format(amount);

    if (language === 'en') {
        return `${formattedAmount} ${amount === 1 ? 'token' : 'tokens'}`;
    }

    if (!Number.isInteger(amount)) {
        return `${formattedAmount} токена`;
    }

    const absAmount = Math.abs(amount);
    const lastTwoDigits = absAmount % 100;
    const lastDigit = absAmount % 10;

    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
        return `${formattedAmount} токенов`;
    }
    if (lastDigit === 1) {
        return `${formattedAmount} токен`;
    }
    if (lastDigit >= 2 && lastDigit <= 4) {
        return `${formattedAmount} токена`;
    }
    return `${formattedAmount} токенов`;
};

export const mapTokenPricesToPackages = (
    tokenPrices: TokenPrice[] = []
): TokenPackage[] =>
    tokenPrices.map((tokenPrice, index) => ({
        key: `${tokenPrice.tokensToPurchase}-${tokenPrice.costRubles}-${index}`,
        amount: tokenPrice.tokensToPurchase,
        price: tokenPrice.costRubles,
    }));

/** Placeholder targets until real legal pages are published. */
export const TOKEN_LEGAL_LINKS = {
    publicOffer: 'https://example.com/labkeeper-public-offer',
    personalData: 'https://example.com/labkeeper-personal-data',
    privacyPolicy: 'https://example.com/labkeeper-privacy-policy',
} as const;
