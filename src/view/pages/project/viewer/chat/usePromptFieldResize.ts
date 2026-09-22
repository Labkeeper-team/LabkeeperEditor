import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type KeyboardEvent,
    type PointerEvent,
    type RefObject,
} from 'react';

/** Столько ленты остаётся видно при самой высокой панели запроса */
const TRANSCRIPT_MIN_HEIGHT = 120;
/** Шаг стрелки равен строке поля, Shift и PageUp/PageDown шагают на пять строк */
const KEYBOARD_STEP = 18;
const KEYBOARD_PAGE_STEP = KEYBOARD_STEP * 5;
/** Меньше этого сдвига считаем кликом, а не перетаскиванием */
const DRAG_THRESHOLD_PX = 2;
/** Зажатая стрелка не пишет весь срез persistence в localStorage на каждый повтор */
const KEYBOARD_COMMIT_DELAY_MS = 300;
/** Пока тянут, курсор не мигает, когда мышь уходит с тонкой ручки */
const RESIZING_BODY_CLASS = 'agent-chat-resizing';

type PromptBounds = { min: number; max: number };

const clamp = (value: number, bounds: PromptBounds) =>
    Math.min(Math.max(value, bounds.min), bounds.max);

/** Границы в пикселях вёрстки (offsetHeight): между 768 и 1024 шелл уменьшен через transform: scale */
const measurePromptBounds = (
    field: HTMLElement,
    isEmpty: boolean
): PromptBounds => {
    const chat = field.parentElement as HTMLElement;
    const input = field.querySelector<HTMLElement>('.agent-chat__input');
    const editor = field.querySelector<HTMLElement>('.cm-editor');
    const chatStyle = getComputedStyle(chat);
    const inner =
        chat.clientHeight -
        parseFloat(chatStyle.paddingTop) -
        parseFloat(chatStyle.paddingBottom);
    const gap = parseFloat(chatStyle.rowGap) || 0;
    const siblings = Array.from(chat.children).filter(
        (child) => child !== field
    ) as HTMLElement[];
    let others = 0;
    for (const sibling of siblings) {
        const isTranscript = sibling.classList.contains(
            'agent-chat__transcript'
        );
        // в пустом чате лента занимает только свой спиннер или подсказку
        others +=
            isTranscript && !isEmpty
                ? TRANSCRIPT_MIN_HEIGHT
                : sibling.offsetHeight;
    }
    const chrome = field.offsetHeight - (input?.offsetHeight ?? 0);
    const editorMin = editor
        ? parseFloat(getComputedStyle(editor).minHeight) || 0
        : 0;
    const min = Math.ceil(chrome + editorMin);
    const max = Math.max(
        min,
        Math.floor(inner - gap * siblings.length - others)
    );
    return { min, max };
};

type Drag = {
    pointerId: number;
    startY: number;
    startHeight: number;
    scale: number;
    factor: number;
    bounds: PromptBounds;
    last: number;
    moved: boolean;
};

type PendingKeyboard = { height: number; timer: number };

export const usePromptFieldResize = ({
    fieldRef,
    enabled,
    isEmpty,
    storedHeight,
    onCommit,
}: {
    fieldRef: RefObject<HTMLDivElement | null>;
    enabled: boolean;
    isEmpty: boolean;
    storedHeight: number | null;
    onCommit: (height: number | null) => void;
}) => {
    const [bounds, setBounds] = useState<PromptBounds | null>(null);
    // высота, которую ещё не записали в хранилище: ручку тянут или жмут стрелки
    const [liveHeight, setLiveHeight] = useState<number | null>(null);
    const [renderedHeight, setRenderedHeight] = useState(0);
    const drag = useRef<Drag | null>(null);
    const keyboard = useRef<PendingKeyboard | null>(null);

    useLayoutEffect(() => {
        const field = fieldRef.current;
        const chat = field?.parentElement;
        if (!enabled || !field || !chat) {
            return;
        }
        const update = () => {
            const next = measurePromptBounds(field, isEmpty);
            setBounds((prev) =>
                prev && prev.min === next.min && prev.max === next.max
                    ? prev
                    : next
            );
            // во время перетаскивания высоту и так знает liveHeight, лишний рендер на каждый кадр ни к чему
            if (!drag.current) {
                setRenderedHeight(field.offsetHeight);
            }
        };
        update();
        const observer = new ResizeObserver(update);
        observer.observe(chat);
        observer.observe(field);
        return () => observer.disconnect();
    }, [enabled, isEmpty, fieldRef]);

    const commitKeyboard = useCallback(() => {
        const pending = keyboard.current;
        if (!pending) {
            return;
        }
        keyboard.current = null;
        window.clearTimeout(pending.timer);
        onCommit(pending.height);
        setLiveHeight(null);
    }, [onCommit]);

    // ручка пропала посреди перетаскивания (узкое окно, компиляция открыла PDF), и lostpointercapture ушёл в document
    useEffect(() => {
        if (!enabled) {
            return;
        }
        return () => {
            drag.current = null;
            document.body.classList.remove(RESIZING_BODY_CLASS);
            setLiveHeight(null);
        };
    }, [enabled]);

    // в localStorage могло попасть что угодно, а NaN в style.height ломает поле
    const saved = Number.isFinite(storedHeight) ? storedHeight : null;
    const height = !enabled
        ? null
        : (liveHeight ??
          (saved != null && bounds ? clamp(saved, bounds) : saved));

    const finish = useCallback(
        (pointerId: number, commit: boolean) => {
            const current = drag.current;
            // второй палец на сенсорном экране отпустили над ручкой, а тянет всё ещё первый
            if (!current || current.pointerId !== pointerId) {
                return;
            }
            drag.current = null;
            document.body.classList.remove(RESIZING_BODY_CLASS);
            setLiveHeight(null);
            // клик без сдвига, в том числе первый клик двойного, не должен выключать авторост
            if (commit && current.moved) {
                onCommit(Math.round(current.last));
            }
        },
        [onCommit]
    );

    const reset = () => {
        const pending = keyboard.current;
        if (pending) {
            keyboard.current = null;
            window.clearTimeout(pending.timer);
        }
        setLiveHeight(null);
        onCommit(null);
    };

    const onPointerDown = (event: PointerEvent<HTMLElement>) => {
        const field = fieldRef.current;
        if (!field || !event.isPrimary || event.button !== 0) {
            return;
        }
        // без этого мышь начинает выделять текст ленты, а фокус уходит из поля
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        // иначе отложенная запись стрелки сработает посреди перетаскивания и откатит поле
        commitKeyboard();
        const next = measurePromptBounds(field, isEmpty);
        const startHeight = field.offsetHeight;
        drag.current = {
            pointerId: event.pointerId,
            startY: event.clientY,
            startHeight,
            scale: field.getBoundingClientRect().height / startHeight || 1,
            // пустой чат держит поле посередине, и верхний край уходит вдвое медленнее роста высоты
            factor: isEmpty ? 2 : 1,
            bounds: next,
            last: startHeight,
            moved: false,
        };
        document.body.classList.add(RESIZING_BODY_CLASS);
        setBounds(next);
    };

    const onPointerMove = (event: PointerEvent<HTMLElement>) => {
        const current = drag.current;
        if (!current || event.pointerId !== current.pointerId) {
            return;
        }
        // кнопку отпустили там, откуда pointerup не дошёл: тянуть дальше нельзя, а записывать нечего
        if (event.pointerType === 'mouse' && event.buttons === 0) {
            finish(event.pointerId, false);
            return;
        }
        const shift = current.startY - event.clientY;
        if (!current.moved && Math.abs(shift) < DRAG_THRESHOLD_PX) {
            return;
        }
        current.moved = true;
        current.last = clamp(
            current.startHeight + (shift / current.scale) * current.factor,
            current.bounds
        );
        setLiveHeight(current.last);
    };

    const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        const field = fieldRef.current;
        if (!field) {
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            reset();
            return;
        }
        const next = measurePromptBounds(field, isEmpty);
        const current = field.offsetHeight;
        const step = event.shiftKey ? KEYBOARD_PAGE_STEP : KEYBOARD_STEP;
        let target: number;
        switch (event.key) {
            case 'ArrowUp':
                target = current + step;
                break;
            case 'ArrowDown':
                target = current - step;
                break;
            case 'PageUp':
                target = current + KEYBOARD_PAGE_STEP;
                break;
            case 'PageDown':
                target = current - KEYBOARD_PAGE_STEP;
                break;
            case 'Home':
                target = next.min;
                break;
            case 'End':
                target = next.max;
                break;
            default:
                return;
        }
        event.preventDefault();
        setBounds(next);
        const value = Math.round(clamp(target, next));
        setLiveHeight(value);
        if (keyboard.current) {
            window.clearTimeout(keyboard.current.timer);
        }
        keyboard.current = {
            height: value,
            timer: window.setTimeout(commitKeyboard, KEYBOARD_COMMIT_DELAY_MS),
        };
    };

    return {
        height,
        dragging: liveHeight != null,
        separatorProps: {
            role: 'separator',
            'aria-orientation': 'horizontal' as const,
            'aria-valuemin': bounds?.min,
            'aria-valuemax': bounds?.max,
            'aria-valuenow': Math.round(height ?? renderedHeight),
            tabIndex: 0,
            onPointerDown,
            onPointerMove,
            onPointerUp: (event: PointerEvent<HTMLElement>) =>
                finish(event.pointerId, true),
            onPointerCancel: (event: PointerEvent<HTMLElement>) =>
                finish(event.pointerId, false),
            onLostPointerCapture: (event: PointerEvent<HTMLElement>) =>
                finish(event.pointerId, true),
            onKeyDown,
            onDoubleClick: reset,
        },
    };
};
