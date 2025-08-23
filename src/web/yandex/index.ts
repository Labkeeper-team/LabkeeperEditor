import { ObserverService } from '../../model/service/observer.ts';
import { Secrets } from '../../constants.ts';

export class MetrikaService implements ObserverService {
    onEvent(event: string) {
        this.metrika('reachGoal', event);
    }
    setUserState(name: string, value: string) {
        const map = {};
        map[name] = value;
        this.metrika('userParams', JSON.stringify(map));
    }

    private metrika(first: string, second: string) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        window.ym(Secrets.yandexMetrikaKey, first, second);
    }
}
