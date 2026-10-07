import classNames from 'classnames';
import { useSelector } from 'react-redux';
import { useDictionary } from '../../../../../store/selectors/translations.ts';
import { InstructionItem } from '../../../../../../model/help';

/** В тексте пункта код выделяют тройными обратными кавычками, как в markdown */
const renderPoint = (point: string) => {
    if (!point.includes('```')) {
        return point;
    }
    return point
        .split(/(```[^`]+```)/g)
        .filter(Boolean)
        .map((part, index) => {
            const code = part.match(/^```([^`]+)```$/);
            return code ? (
                <code key={index} className="instruction-slide__code">
                    {code[1]}
                </code>
            ) : (
                <span key={index}>{part}</span>
            );
        });
};

/**
 * Один слайд помощи. Сетка у всех слайдов общая: заголовок сверху слева,
 * под ним пункты, справа картинка в своей ячейке. Так заголовки и картинки
 * стоят на одних местах, а не прыгают от длины текста
 */
export const InstructionItemComponent = ({
    item,
}: {
    item: InstructionItem;
}) => {
    const dictionary = useSelector(useDictionary);
    const hasWikiLink = Boolean(item.ending && item.wikiLink);

    return (
        <div
            className={classNames('instruction-slide', {
                'instruction-slide--no-image': !item.image,
            })}
        >
            <div className="instruction-slide__text">
                <div className="instruction-slide__title">{item.title}</div>
                {/* длинный текст в узкой колонке прокручивается, а не обрезается молча.
                    Не ul и li: по роли listitem на странице ищут пункты меню */}
                <div className="instruction-slide__points">
                    {item.points.map((point, index) => (
                        <div key={index} className="instruction-slide__point">
                            {renderPoint(point)}
                        </div>
                    ))}
                </div>
                {hasWikiLink ? (
                    <div className="instruction-slide__more">
                        {item.ending}{' '}
                        <a
                            href={item.wikiLink}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {dictionary.wiki}
                        </a>
                    </div>
                ) : null}
            </div>
            {item.image ? (
                <div className="instruction-slide__image">
                    <img src={item.image} alt="" />
                </div>
            ) : null}
        </div>
    );
};
