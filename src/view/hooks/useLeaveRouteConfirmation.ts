import { useCallback, useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

/** Роутер отдаёт в предикат больше, но для решения хватает адресов */
type NavigationLocations = {
    currentLocation: { pathname: string };
    nextLocation: { pathname: string };
};

/**
 * Подтверждение на переходы внутри приложения.
 * Браузерная панель их не ловит: роутер меняет страницу без выгрузки
 * документа, и beforeunload не срабатывает. Панель тут тоже системная,
 * только текст свой.
 *
 * shouldBlock спрашивается в момент перехода, а не при отрисовке: приложение
 * умеет само погасить агента прямо перед своим же переходом, и значение,
 * снятое на прошлой отрисовке, к этому моменту уже врёт.
 */
export const useLeaveRouteConfirmation = (
    shouldBlock: () => boolean,
    message: string
) => {
    const blockNavigation = useCallback(
        ({ currentLocation, nextLocation }: NavigationLocations) =>
            // адрес проекта лежит в истории дважды, и первое «назад» ведёт на
            // него же. Спрашивать про уход там, откуда никуда не уходят, нельзя:
            // человек согласится и останется на месте
            currentLocation.pathname !== nextLocation.pathname && shouldBlock(),
        [shouldBlock]
    );
    const blocker = useBlocker(blockNavigation);

    useEffect(() => {
        if (blocker.state !== 'blocked') {
            return;
        }
        // роутер спросил синхронно, а сюда мы попадаем тактом позже: за этот
        // зазор агент мог договорить, и спрашивать было бы уже не о чем
        if (!shouldBlock()) {
            blocker.proceed();
            return;
        }
        // confirm держит поток, поэтому состояние за это время не поедет
        if (window.confirm(message)) {
            blocker.proceed();
            return;
        }
        blocker.reset();
    }, [blocker, message, shouldBlock]);
};
