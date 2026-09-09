import { ViewModelRepository } from '../repository';

/**
 * Не чаще одного мини-сообщения за это время. При зажатой клавише иначе улетает
 * по тосту на каждое нажатие и лента сообщений перекрывает редактор. Окно шире,
 * чем время жизни тоста (по умолчанию 5 секунд), иначе они начнут копиться.
 */
const NOTICE_INTERVAL_MS = 6000;

/**
 * Пока агент работает, сервер не принимает изменения проекта, поэтому правки
 * блокируются целиком. Кнопки при этом остаются на месте: по нажатию показываем
 * мини-сообщение, а не прячем управление, как это делает режим чужого проекта.
 */
export class EditingLockService {
    private lastNoticeAt = 0;

    constructor(private repository: ViewModelRepository) {}

    isLocked = (): boolean => {
        const state = this.repository.chatViewModelRepository.requestState();
        return state === 'connecting' || state === 'running';
    };

    /** Мини-сообщение о блокировке, с защитой от потока дублей. */
    notify = (): void => {
        const now = Date.now();
        if (now - this.lastNoticeAt < NOTICE_INTERVAL_MS) {
            return;
        }
        this.lastNoticeAt = now;
        this.repository.toast(
            this.repository.dictionary.agent_chat.editing_locked,
            'info'
        );
    };

    /** true, если правку надо отклонить. Заодно показывает мини-сообщение. */
    rejectEdit = (): boolean => {
        if (!this.isLocked()) {
            return false;
        }
        this.notify();
        return true;
    };
}
