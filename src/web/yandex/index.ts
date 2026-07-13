import { ObserverService } from '../../model/service/ObserverService.ts';
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
        if (
            localStorage.getItem('labkeeper_cookie_consent') !== 'accepted' ||
            typeof window.ym !== 'function'
        ) {
            return;
        }

        window.ym(Secrets.yandexMetrikaKey, first, second);
    }
}
