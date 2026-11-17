import { RequestResult } from '../../model/rpi';

/** Сервер держит проект под операцией: 423 */
export const HTTP_LOCKED = 423;

/**
 * Паузы перед повторами запроса, на который сервер ответил 423. Проект
 * держит и короткая операция, например сохранение программы, которое ушло
 * рядом с приёмом правки: такой замок снимается за доли секунды, и повтор
 * проходит незаметно для человека. Прогон агента держит проект дольше, и
 * тогда после повторов остаётся 423, о котором надо сказать
 */
export const LOCK_RETRY_DELAYS_MS = [400, 1200];

const pause = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Запрос и его повторы, пока сервер отвечает 423 и паузы не кончились */
export async function retryWhileLocked<T>(
    request: () => Promise<RequestResult<T>>,
    delays: readonly number[] = LOCK_RETRY_DELAYS_MS
): Promise<RequestResult<T>> {
    let result = await request();
    for (const delay of delays) {
        if (result.code !== HTTP_LOCKED) {
            break;
        }
        await pause(delay);
        result = await request();
    }
    return result;
}
