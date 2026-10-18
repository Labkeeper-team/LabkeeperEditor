import { useDispatch, useSelector } from 'react-redux';

import { AppDispatch } from '../../../store';
import { setShowHotkeysHelp } from '../../../store/slices/settings';
import { useDictionary } from '../../../store/selectors/translations';
import { HotkeyCode, PROJECT_HOTKEYS } from './catalog.ts';
import { Keys } from './Keys.tsx';

import './slide.scss';

/** Самые ходовые сочетания: остальные в полном списке по ссылке под ними */
const SLIDE_ROWS: { label: HotkeyCode | 'segment_step'; hotkeys: string[] }[] =
    [
        { label: 'compile', hotkeys: [PROJECT_HOTKEYS.compile] },
        { label: 'search_open', hotkeys: [PROJECT_HOTKEYS.search_open] },
        {
            label: 'segment_step',
            hotkeys: [
                PROJECT_HOTKEYS.segment_prev,
                PROJECT_HOTKEYS.segment_next,
            ],
        },
        { label: 'viewer_chat', hotkeys: [PROJECT_HOTKEYS.viewer_chat] },
    ];

/**
 * GH-172: слайд о сочетаниях в карусели советов. Разметка как у остальных слайдов,
 * чтобы заголовок и картинка стояли на тех же местах; вместо картинки крупные клавиши сборки.
 * Собирается здесь, а не в model/help: подписи клавиш зависят от платформы
 */
export const HotkeysSlide = () => {
    const dispatch = useDispatch<AppDispatch>();
    const text = useSelector(useDictionary).hotkeys;

    return (
        <div className="instruction-slide hotkeys-slide">
            <div className="instruction-slide__text">
                <div className="instruction-slide__title">{text.title}</div>
                <div className="instruction-slide__points">
                    {SLIDE_ROWS.map((row) => (
                        <div
                            key={row.label}
                            className="instruction-slide__point"
                        >
                            {text.actions[row.label]}{' '}
                            <Keys
                                className="hotkeys-slide__keys"
                                hotkeys={row.hotkeys}
                            />
                        </div>
                    ))}
                </div>
                <div className="instruction-slide__more">
                    {text.slide_more}{' '}
                    <button
                        type="button"
                        className="hotkeys-slide__open"
                        onClick={() => dispatch(setShowHotkeysHelp(true))}
                    >
                        {text.open}
                    </button>
                </div>
            </div>
            <div className="instruction-slide__image" aria-hidden>
                <Keys
                    className="hotkeys-slide__hero"
                    hotkeys={[PROJECT_HOTKEYS.compile]}
                />
            </div>
        </div>
    );
};
