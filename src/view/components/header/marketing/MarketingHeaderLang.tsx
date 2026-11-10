import { Language, LANGUAGES } from '../../../../viewModel/dictionaries';

type Props = {
    language: Language;
    onSelect: (lang: Language) => void;
    wrapperClassName: string;
};

const SHORT_NAMES: Record<Language, string> = {
    ru: 'Ru',
    en: 'En',
    zh: '中文',
};

export const MarketingHeaderLang = ({
    language,
    onSelect,
    wrapperClassName,
}: Props) => (
    <div className={wrapperClassName}>
        {LANGUAGES.map((lang) => (
            <button
                key={lang}
                className={`marketing-header__lang-btn${
                    language === lang
                        ? ' marketing-header__lang-btn--active'
                        : ''
                }`}
                type="button"
                onClick={() => onSelect(lang)}
            >
                {SHORT_NAMES[lang]}
            </button>
        ))}
    </div>
);
