import { TokenPrice } from '../../../model/rpi';

export type TokenPackage = {
    key: string;
    tokenPriceId: string;
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

export const formatTokenNumber = (
    amount: number,
    language: 'ru' | 'en'
): string =>
    new Intl.NumberFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
        maximumFractionDigits: 2,
    }).format(amount);

const pluralRu = (
    value: number,
    one: string,
    few: string,
    many: string
): string => {
    const abs = Math.abs(value);
    const lastTwo = abs % 100;
    const last = abs % 10;
    if (lastTwo >= 11 && lastTwo <= 14) {
        return many;
    }
    if (last === 1) {
        return one;
    }
    if (last >= 2 && last <= 4) {
        return few;
    }
    return many;
};

/** Human-readable refill interval from API seconds (e.g. 30d → "30 дней"). */
export const formatRefillPeriod = (
    periodSeconds: number,
    language: 'ru' | 'en'
): string => {
    if (!Number.isFinite(periodSeconds) || periodSeconds <= 0) {
        return language === 'ru' ? 'регулярно' : 'regularly';
    }

    const minute = 60;
    const hour = 60 * minute;
    const day = 24 * hour;
    const units: {
        seconds: number;
        en: [string, string];
        ru: [string, string, string];
    }[] = [
        {
            seconds: day,
            en: ['day', 'days'],
            ru: ['день', 'дня', 'дней'],
        },
        {
            seconds: hour,
            en: ['hour', 'hours'],
            ru: ['час', 'часа', 'часов'],
        },
        {
            seconds: minute,
            en: ['minute', 'minutes'],
            ru: ['минуту', 'минуты', 'минут'],
        },
    ];

    for (const unit of units) {
        if (periodSeconds % unit.seconds === 0) {
            const count = periodSeconds / unit.seconds;
            if (language === 'en') {
                const word = count === 1 ? unit.en[0] : unit.en[1];
                return `${count} ${word}`;
            }
            return `${count} ${pluralRu(count, ...unit.ru)}`;
        }
    }

    const days = Math.max(1, Math.round(periodSeconds / day));
    if (language === 'en') {
        return `${days} ${days === 1 ? 'day' : 'days'}`;
    }
    return `${days} ${pluralRu(days, 'день', 'дня', 'дней')}`;
};

export const mapTokenPricesToPackages = (
    tokenPrices: TokenPrice[] = []
): TokenPackage[] =>
    tokenPrices.map((tokenPrice, index) => ({
        key: `${tokenPrice.tokensToPurchase}-${tokenPrice.costRubles}-${index}`,
        tokenPriceId: tokenPrice.id,
        amount: tokenPrice.tokensToPurchase,
        price: tokenPrice.costRubles,
    }));

/** Placeholder targets until real legal pages are published. */
export const TOKEN_LEGAL_LINKS = {
    publicOffer: '/oferta',
    personalData: '/soglas',
    privacyPolicy: '/privacy',
} as const;
