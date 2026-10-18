import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useIsMobile } from '../../../hooks/useMobile';
import {
    EXISTING_HOTKEYS,
    ExistingHotkey,
    HotkeyCode,
    PROJECT_HOTKEYS,
} from './catalog.ts';
import { HINT_SELECTOR } from './hint.ts';
import { Keys } from './Keys.tsx';

import './tooltip.scss';

const SHOW_DELAY_MS = 600;
// отступ от кнопки и от краёв окна
const GAP = 8;

type Shown = {
    anchor: Element;
    label: string | null;
    hotkeys: readonly string[];
};

const hotkeysOf = (code: string | null): readonly string[] | null => {
    if (!code) {
        return null;
    }
    if (Object.prototype.hasOwnProperty.call(PROJECT_HOTKEYS, code)) {
        return [PROJECT_HOTKEYS[code as HotkeyCode]];
    }
    return Object.prototype.hasOwnProperty.call(EXISTING_HOTKEYS, code)
        ? EXISTING_HOTKEYS[code as ExistingHotkey]
        : null;
};

const anchorOf = (target: EventTarget | null): Element | null =>
    target instanceof Element ? target.closest(HINT_SELECTOR) : null;

/**
 * GH-172: одна подсказка с клавишами на всю страницу проекта, её зовут кнопки через hotkeyHint.
 * Всплывает, только когда курсор задержался на кнопке, и прячется от ухода курсора, нажатия,
 * клавиш и прокрутки. Снова всплывает, только когда курсор ушёл с кнопки и вернулся: иначе
 * после нажатия она всплывала бы, пока кнопка перерисовывается под курсором (у «Выполнить»
 * во время сборки).
 * Своя, а не react-tooltip: в 6.0.8 тот не обнуляет таймер показа и открывается повторно
 * после закрытия по клику. На телефоне клавиатуры нет, подсказки тоже
 */
export const HotkeyTooltip = () => {
    const isMobile = useIsMobile();
    const [shown, setShown] = useState<Shown | null>(null);
    const [position, setPosition] = useState<{
        left: number;
        top: number;
    } | null>(null);
    const tipRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isMobile) {
            return;
        }
        let timer: number | undefined;
        let hovered: Element | null = null;

        const hide = () => {
            window.clearTimeout(timer);
            timer = undefined;
            setShown(null);
        };
        const onMouseOver = (event: MouseEvent) => {
            const anchor = anchorOf(event.target);
            // движение внутри кнопки или перерисовка под курсором
            if (anchor === hovered) {
                return;
            }
            hide();
            hovered = anchor;
            if (!anchor) {
                return;
            }
            timer = window.setTimeout(() => {
                const hotkeys = hotkeysOf(anchor.getAttribute('data-hotkey'));
                if (anchor.isConnected && hotkeys) {
                    setShown({
                        anchor,
                        label: anchor.getAttribute('data-hotkey-label'),
                        hotkeys,
                    });
                }
            }, SHOW_DELAY_MS);
        };
        const onMouseOut = (event: MouseEvent) => {
            const next = event.relatedTarget;
            if (!hovered || (next instanceof Node && hovered.contains(next))) {
                return;
            }
            hovered = null;
            hide();
        };

        document.addEventListener('mouseover', onMouseOver, true);
        document.addEventListener('mouseout', onMouseOut, true);
        document.addEventListener('pointerdown', hide, true);
        // нажатие, набор, прокрутка и смена размера уводят внимание от кнопки
        document.addEventListener('keydown', hide, true);
        document.addEventListener('scroll', hide, true);
        window.addEventListener('resize', hide);
        return () => {
            window.clearTimeout(timer);
            document.removeEventListener('mouseover', onMouseOver, true);
            document.removeEventListener('mouseout', onMouseOut, true);
            document.removeEventListener('pointerdown', hide, true);
            document.removeEventListener('keydown', hide, true);
            document.removeEventListener('scroll', hide, true);
            window.removeEventListener('resize', hide);
        };
    }, [isMobile]);

    // под кнопкой, а если внизу не помещается или кнопка просит, над ней; по ширине внутри окна
    useLayoutEffect(() => {
        const tip = tipRef.current;
        if (!shown || !tip) {
            setPosition(null);
            return;
        }
        const anchor = shown.anchor.getBoundingClientRect();
        const { width, height } = tip.getBoundingClientRect();
        const below = anchor.bottom + GAP;
        const above = anchor.top - GAP - height;
        const wantsTop =
            shown.anchor.getAttribute('data-hotkey-place') === 'top';
        const fitsBelow = below + height <= window.innerHeight - GAP;
        const top = (wantsTop && above >= GAP) || !fitsBelow ? above : below;
        const left = Math.min(
            Math.max(GAP, anchor.left + anchor.width / 2 - width / 2),
            window.innerWidth - GAP - width
        );
        setPosition({ left, top: Math.max(GAP, top) });
    }, [shown]);

    if (isMobile || !shown) {
        return null;
    }

    return createPortal(
        <div
            ref={tipRef}
            role="tooltip"
            className="hotkey-tooltip"
            style={
                position
                    ? { left: position.left, top: position.top }
                    : { visibility: 'hidden' }
            }
        >
            {shown.label ? <span>{shown.label}</span> : null}
            <Keys className="hotkey-tooltip__keys" hotkeys={shown.hotkeys} />
        </div>,
        document.body
    );
};
