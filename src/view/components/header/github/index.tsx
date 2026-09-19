import { useSelector } from 'react-redux';

import { GithubIcon } from '../../../icons';
import { useDictionary } from '../../../store/selectors/translations';
import { ExternalLinks } from '../../../../viewModel/externalLinks.ts';
import { controller } from '../../../../main.tsx';
import { Events } from '../../../../model/service/ObserverService.ts';

import './style.scss';

export const GithubLink = () => {
    const dictionary = useSelector(useDictionary);

    // именно ссылка, а не кнопка с window.open: иначе не работают средняя кнопка мыши и «открыть в новой вкладке»
    return (
        <a
            className="github-link"
            href={ExternalLinks.github}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={dictionary.header_menu.github}
            title={dictionary.header_menu.github}
            onClick={() =>
                controller.trackUiEvent(Events.EVENT_GITHUB_CLICKED, {
                    source: 'header',
                })
            }
        >
            <GithubIcon />
        </a>
    );
};
