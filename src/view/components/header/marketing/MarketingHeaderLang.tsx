import { Language } from '../../../../viewModel/dictionaries';

type Props = {
    language: Language;
    onSelect: (lang: Language) => void;
    wrapperClassName: string;
};

export const MarketingHeaderLang = ({
    language,
    onSelect,
    wrapperClassName,
}: Props) => (
    <div className={wrapperClassName}>
        <button
            className={`marketing-header__lang-btn${
                language === 'ru' ? ' marketing-header__lang-btn--active' : ''
            }`}
            type="button"
            onClick={() => onSelect('ru')}
        >
            Ru
        </button>
        <button
            className={`marketing-header__lang-btn${
                language === 'en' ? ' marketing-header__lang-btn--active' : ''
            }`}
            type="button"
            onClick={() => onSelect('en')}
        >
            En
        </button>
    </div>
);
