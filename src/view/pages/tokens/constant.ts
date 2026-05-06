type TokenPackageKey = 'small' | 'medium' | 'large';

export type TokenPackage = {
    key: TokenPackageKey;
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

/** Placeholder targets until real legal pages are published. */
export const TOKEN_LEGAL_LINKS = {
    publicOffer: 'https://example.com/labkeeper-public-offer',
    personalData: 'https://example.com/labkeeper-personal-data',
} as const;

export const TOKEN_PACKAGES: TokenPackage[] = [
    {
        key: 'small',
        amount: 10,
        price: 99,
    },
    {
        key: 'medium',
        amount: 100,
        price: 799,
    },
    {
        key: 'large',
        amount: 1000,
        price: 5990,
    },
];