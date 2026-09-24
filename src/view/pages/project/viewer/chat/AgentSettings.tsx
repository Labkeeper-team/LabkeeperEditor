import {
    useCallback,
    useEffect,
    useId,
    useLayoutEffect,
    useRef,
    useState,
    type KeyboardEvent,
    type ReactNode,
    type RefObject,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, StorageState } from '../../../../store';
import { useDictionary } from '../../../../store/selectors/translations';
import { controller } from '../../../../../main.tsx';
import { AGENT_ITERATION_OPTIONS } from '../../../../../model/rpi/agentSocket.ts';
import { SegmentedControl } from '../../../../components/segmentedControl';
import { CloseIcon, CodeSettingsIcon } from '../../../../icons';

const PANEL_ID = 'agent-chat-settings';
/** Зазор между панелью и рядом кнопок */
const PANEL_GAP = 8;

type PanelPlace = { bottom: number; maxHeight: number };

/** Панель над рядом кнопок растёт вверх не выше колонки чата, потому что выше её обрезал бы overflow hidden у .project-pane на телефоне; счёт в пикселях вёрстки, потому что между 768 и 1024 шелл уменьшен через transform: scale */
const measurePanelPlace = (
    field: HTMLElement,
    controls: HTMLElement
): PanelPlace => {
    const chat = field.parentElement as HTMLElement;
    const scale =
        field.getBoundingClientRect().height / field.offsetHeight || 1;
    const chatTop =
        chat.getBoundingClientRect().top / scale +
        parseFloat(getComputedStyle(chat).paddingTop);
    // при открытой клавиатуре iOS видимая часть окна может начинаться ниже верха чата
    const viewportTop = (window.visualViewport?.offsetTop ?? 0) / scale;
    const controlsTop = controls.getBoundingClientRect().top / scale;
    return {
        bottom: field.clientHeight - controls.offsetTop + PANEL_GAP,
        maxHeight: Math.max(
            0,
            Math.floor(controlsTop - PANEL_GAP - Math.max(chatTop, viewportTop))
        ),
    };
};

const SettingsSection = ({
    title,
    hint,
    children,
}: {
    title: string;
    hint: string;
    children: ReactNode;
}) => (
    <section className="agent-settings__section">
        <div className="agent-settings__section-title">{title}</div>
        {/* значения выше подсказки: на низком экране их видно без прокрутки панели */}
        {children}
        {/* на сенсорном экране title не показывается, поэтому подсказка написана текстом */}
        <p className="agent-settings__hint">{hint}</p>
    </section>
);

/** Кнопка настроек агента в ряду поля и панель над рядом. Новые параметры добавляются секциями */
export const AgentSettings = ({
    fieldRef,
    controlsRef,
    isRunning,
}: {
    fieldRef: RefObject<HTMLDivElement | null>;
    controlsRef: RefObject<HTMLDivElement | null>;
    isRunning: boolean;
}) => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const iterations = useSelector(
        (state: StorageState) => state.persistence.agentIterations
    );
    const [open, setOpen] = useState(false);
    const [place, setPlace] = useState<PanelPlace | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const titleId = useId();

    const close = useCallback((returnFocus: boolean) => {
        setOpen(false);
        if (returnFocus) {
            buttonRef.current?.focus({ preventScroll: true });
        }
    }, []);

    useLayoutEffect(() => {
        const field = fieldRef.current;
        const controls = controlsRef.current;
        const chat = field?.parentElement;
        if (!open || !field || !controls || !chat) {
            return;
        }
        const update = () => {
            const next = measurePanelPlace(field, controls);
            setPlace((prev) =>
                prev &&
                prev.bottom === next.bottom &&
                prev.maxHeight === next.maxHeight
                    ? prev
                    : next
            );
        };
        update();
        const observer = new ResizeObserver(update);
        observer.observe(chat);
        observer.observe(field);
        observer.observe(controls);
        return () => observer.disconnect();
    }, [open, fieldRef, controlsRef]);

    // фокус в панель: клавиатура телефона прячется, а Esc и Tab работают сразу
    useEffect(() => {
        if (open) {
            panelRef.current?.focus({ preventScroll: true });
        }
    }, [open]);

    useEffect(() => {
        if (!open) {
            return;
        }
        // клик мимо панели закрывает её и оставляет фокус там, куда кликнули, как у popover в браузере
        const onPointerDown = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                close(false);
            }
        };
        // в фазе захвата: обработчики внутри страницы не должны проглотить клик мимо
        document.addEventListener('pointerdown', onPointerDown, true);
        return () =>
            document.removeEventListener('pointerdown', onPointerDown, true);
    }, [open, close]);

    const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        if (!open || event.key !== 'Escape') {
            return;
        }
        // Esc страницы закрыл бы заодно поиск или менеджер файлов
        event.stopPropagation();
        event.preventDefault();
        close(true);
    };

    return (
        <div ref={rootRef} className="agent-settings" onKeyDown={onKeyDown}>
            <button
                ref={buttonRef}
                type="button"
                className="agent-settings__toggle"
                aria-label={dictionary.agent_chat.settings}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-controls={open ? PANEL_ID : undefined}
                onClick={() => (open ? close(true) : setOpen(true))}
            >
                <CodeSettingsIcon />
            </button>
            {open && (
                <div
                    ref={panelRef}
                    id={PANEL_ID}
                    role="dialog"
                    aria-labelledby={titleId}
                    tabIndex={-1}
                    className="agent-settings__panel"
                    // до замера стиля нет: useLayoutEffect перерисует панель раньше, чем браузер её покажет
                    style={
                        place
                            ? {
                                  bottom: place.bottom,
                                  maxHeight: place.maxHeight,
                              }
                            : undefined
                    }
                >
                    <div className="agent-settings__header">
                        <div id={titleId} className="agent-settings__title">
                            {dictionary.agent_chat.settings}
                        </div>
                        <button
                            type="button"
                            className="agent-settings__close"
                            aria-label={dictionary.agent_chat.settings_close}
                            onClick={() => close(true)}
                        >
                            <CloseIcon />
                        </button>
                    </div>
                    <div className="agent-settings__body">
                        <SettingsSection
                            title={dictionary.agent_chat.max_iterations}
                            hint={dictionary.agent_chat.max_iterations_hint}
                        >
                            <SegmentedControl
                                ariaLabel={dictionary.agent_chat.max_iterations}
                                options={AGENT_ITERATION_OPTIONS.map(
                                    (value) => ({
                                        value,
                                        label: String(value),
                                    })
                                )}
                                value={iterations}
                                disabled={isRunning}
                                onChange={(value) =>
                                    dispatch(
                                        controller.onAgentIterationsChangedRequest(
                                            { value }
                                        )
                                    )
                                }
                            />
                        </SettingsSection>
                    </div>
                </div>
            )}
        </div>
    );
};
