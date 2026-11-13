import {
    KeyboardEvent,
    MouseEvent,
    ReactNode,
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from 'react';
import { createPortal } from 'react-dom';
import classNames from 'classnames';

import './style.scss';
import { DotssIcon } from '../../icons';

export interface MenuAction {
    key: string;
    label: string;
    icon?: ReactNode;
    danger?: boolean;
    /** Черта над пунктом: отделяет группу действий */
    separated?: boolean;
    onSelect: () => void;
}

const MENU_GAP = 4;
const VIEWPORT_GAP = 8;

/**
 * Щелчок мимо открытого меню только закрывает его. Меню закрывается на
 * pointerdown, а click того же нажатия иначе дошёл бы до строки под курсором
 * и открыл чужой проект (в боковой панели выбрал бы соседнюю метку). Глотаем
 * ровно этот click: после отпускания кнопки страховка снимается
 */
function swallowClickOfThisPress(): void {
    const swallow = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        release();
    };
    const releaseAfterRelease = () => window.setTimeout(release, 0);
    function release() {
        document.removeEventListener('click', swallow, true);
        document.removeEventListener('auxclick', swallow, true);
        document.removeEventListener('pointerup', releaseAfterRelease, true);
    }
    document.addEventListener('click', swallow, true);
    document.addEventListener('auxclick', swallow, true);
    document.addEventListener('pointerup', releaseAfterRelease, true);
}

/**
 * Кнопка «⋯» и её меню действий: строка и карточка проекта, метка в боковой
 * панели. В отличие от DropdownMenu открывается щелчком, работает с
 * клавиатуры и рисуется в body, поэтому колонка с прокруткой его не режет. Меню рисуется поверх страницы
 * в document.body: список проектов прокручивается и обрезал бы его.
 * Щелчки по кнопке и меню до строки не доходят, иначе открылся бы проект
 */
export const ActionMenu = (props: { label: string; actions: MenuAction[] }) => {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState<{ top: number; left: number }>();
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const close = useCallback((focusButton = false) => {
        setOpen(false);
        setPosition(undefined);
        if (focusButton) {
            buttonRef.current?.focus();
        }
    }, []);

    // меню под кнопкой, правым краем к ней; если внизу места нет, то над ней
    useLayoutEffect(() => {
        if (!open || !buttonRef.current || !menuRef.current) {
            return;
        }
        const button = buttonRef.current.getBoundingClientRect();
        const menu = menuRef.current.getBoundingClientRect();
        const below = button.bottom + MENU_GAP;
        const top =
            below + menu.height > window.innerHeight - VIEWPORT_GAP
                ? Math.max(VIEWPORT_GAP, button.top - MENU_GAP - menu.height)
                : below;
        const left = Math.min(
            Math.max(VIEWPORT_GAP, button.right - menu.width),
            window.innerWidth - menu.width - VIEWPORT_GAP
        );
        setPosition({ top, left });
    }, [open]);

    // фокус в меню, только когда оно уже на месте: скрытое фокус не принимает
    useEffect(() => {
        if (position) {
            menuRef.current
                ?.querySelector<HTMLButtonElement>('[role="menuitem"]')
                ?.focus();
        }
    }, [position]);

    useEffect(() => {
        if (!open) {
            return;
        }
        const onPointerDown = (event: PointerEvent) => {
            const target = event.target as Node;
            if (
                menuRef.current?.contains(target) ||
                buttonRef.current?.contains(target)
            ) {
                return;
            }
            swallowClickOfThisPress();
            close();
        };
        // меню стоит на месте, а строка уезжает: проще закрыть
        const onScrollOrResize = () => close();
        document.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('resize', onScrollOrResize);
        window.addEventListener('scroll', onScrollOrResize, true);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('resize', onScrollOrResize);
            window.removeEventListener('scroll', onScrollOrResize, true);
        };
    }, [open, close]);

    const stop = (e: MouseEvent) => e.stopPropagation();

    const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        const items = [
            ...(menuRef.current?.querySelectorAll<HTMLButtonElement>(
                '[role="menuitem"]'
            ) ?? []),
        ];
        const index = items.indexOf(
            document.activeElement as HTMLButtonElement
        );
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            close(true);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            items[(index + 1) % items.length]?.focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            items[(index - 1 + items.length) % items.length]?.focus();
        } else if (e.key === 'Tab') {
            // фокус на кнопку, а дальше Tab уводит его как обычно
            close(true);
        }
    };

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                className={classNames('action-menu-button', {
                    'action-menu-button--open': open,
                })}
                aria-label={props.label}
                aria-haspopup="menu"
                aria-expanded={open}
                title={props.label}
                onClick={(e) => {
                    stop(e);
                    if (open) {
                        close();
                    } else {
                        setOpen(true);
                    }
                }}
                onAuxClick={stop}
                onKeyDown={(e) => {
                    if (open && e.key === 'Escape') {
                        e.preventDefault();
                        e.stopPropagation();
                        close(true);
                    }
                }}
            >
                <DotssIcon />
            </button>
            {open
                ? createPortal(
                      <div
                          ref={menuRef}
                          role="menu"
                          aria-label={props.label}
                          className="action-menu"
                          style={
                              position
                                  ? { top: position.top, left: position.left }
                                  : { visibility: 'hidden', top: 0, left: 0 }
                          }
                          onClick={stop}
                          onAuxClick={stop}
                          onKeyDown={onMenuKeyDown}
                      >
                          {props.actions.map((action) => (
                              <button
                                  key={action.key}
                                  type="button"
                                  role="menuitem"
                                  className={classNames('action-menu__item', {
                                      'action-menu__item--danger':
                                          action.danger,
                                      'action-menu__item--separated':
                                          action.separated,
                                  })}
                                  data-action={action.key}
                                  onClick={() => {
                                      // окно, которое откроет пункт, само заберёт фокус
                                      close(true);
                                      action.onSelect();
                                  }}
                              >
                                  {action.icon ? (
                                      <span className="action-menu__icon">
                                          {action.icon}
                                      </span>
                                  ) : null}
                                  {action.label}
                              </button>
                          ))}
                      </div>,
                      document.body
                  )
                : null}
        </>
    );
};
