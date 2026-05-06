import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

import externalLinkIcon from '../../../assets/marketing-footer-external.svg';
import footerWordmark from '../../../assets/marketing-footer-wordmark.svg';
import footerLogoMark from '../../../assets/marketing-footer-logo-mark.svg';
import {
    useCurrentLanguage,
    useDictionary,
} from '../../../store/selectors/translations';
import { Routes } from '../../../../viewModel/routes.ts';

import './footer.scss';

export const MarketingFooter = () => {
    const dictionary = useSelector(useDictionary);
    const language = useSelector(useCurrentLanguage);
    const nav = dictionary.tokens_page.navigation;
    const footer = dictionary.tokens_page.footer;

    const wikiHref = `https://github.com/Labkeeper-team/Docs/wiki/${language}`;

    /** Same links as labkeeper.io footer (anchors + wiki + about). */
    const navItems: {
        key: string;
        label: string;
        href: string;
        external?: boolean;
    }[] = [
        {
            key: 'advantages',
            label: nav.advantages,
            href: 'https://labkeeper.io/#features',
        },
        {
            key: 'features',
            label: nav.features,
            href: 'https://labkeeper.io/#advantages',
        },
        {
            key: 'wiki',
            label: footer.wiki_nav,
            href: wikiHref,
            external: true,
        },
        {
            key: 'about',
            label: nav.about,
            href: 'https://labkeeper.io/about',
        },
    ];

    return (
        <footer className="marketing-footer">
            <div className="marketing-footer__container">
                <div className="marketing-footer__top">
                    <nav
                        className="marketing-footer__nav"
                        aria-label={footer.nav_aria}
                    >
                        {navItems.map((item) => (
                            <a
                                key={item.key}
                                className={`marketing-footer__link${
                                    item.external
                                        ? ' marketing-footer__link--external'
                                        : ''
                                }`}
                                href={item.href}
                                {...(item.external
                                    ? {
                                          target: '_blank',
                                          rel: 'noopener noreferrer',
                                      }
                                    : {})}
                            >
                                {item.label}
                                {item.external ? (
                                    <img
                                        src={externalLinkIcon}
                                        alt=""
                                        className="marketing-footer__link-icon"
                                        width={10}
                                        height={10}
                                        loading="lazy"
                                    />
                                ) : null}
                            </a>
                        ))}
                    </nav>
                    <Link
                        className="marketing-footer__logo-link"
                        to={Routes.Home}
                        aria-label="Labkeeper"
                    >
                        <img
                            src={footerLogoMark}
                            alt="Labkeeper Logo"
                            className="marketing-footer__logo"
                            width={48}
                            height={48}
                            loading="lazy"
                        />
                    </Link>
                    <div className="marketing-footer__contact">
                        <span className="marketing-footer__contact-label">
                            {footer.contact_label}
                        </span>
                        <a
                            className="marketing-footer__contact-link"
                            href="mailto:contact@labkeeper.io"
                        >
                            contact@labkeeper.io
                        </a>
                    </div>
                </div>
                <div className="marketing-footer__middle">
                    <img
                        src={footerWordmark}
                        alt=""
                        className="marketing-footer__huge-logo"
                        aria-hidden
                        loading="lazy"
                    />
                </div>
                <div className="marketing-footer__bottom">
                    <div className="marketing-footer__copyright">
                        {footer.copyright}
                    </div>
                </div>
            </div>
        </footer>
    );
};
