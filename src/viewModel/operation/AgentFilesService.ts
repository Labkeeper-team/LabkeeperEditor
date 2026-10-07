import {
    Events,
    ObserverService,
} from '../../model/service/ObserverService.ts';
import { ViewModelRepository } from '../repository';
import { trackEvent } from '../utils/observerContext.ts';
import { FileManagerService } from './FileManagerService.ts';

/** Сюда кладём файлы из чата: файлового менеджера в агентском режиме нет, и папку не выбрать */
const ROOT_FOLDER = '';

/** Такие файлы агент вставляет в документ, поэтому после загрузки просим его об этом сами */
const MENTIONED_EXTENSIONS = ['.pdf', '.csv', '.png', '.jpg', '.jpeg', '.svg'];

export const isMentionedOnUpload = (name: string): boolean => {
    const lower = name.toLowerCase();
    return MENTIONED_EXTENSIONS.some((extension) => lower.endsWith(extension));
};

/**
 * Файлы в чате агентского режима: загрузка в проект и просьба к агенту
 * вставить файл в документ. Просьба дописывается в конец запроса, набранный
 * текст остаётся, отправляет человек сам
 */
export class AgentFilesService {
    constructor(
        private repository: ViewModelRepository,
        private fileManagerService: FileManagerService,
        private observerService: ObserverService
    ) {}

    private track(event: string, properties?: Record<string, unknown>) {
        trackEvent(this.observerService, this.repository, event, properties);
    }

    /** Гость кликнул по зоне или кнопке: файлы живут в аккаунте, поэтому вместо выбора файла окно входа */
    onGuestFileAttempt = (): void => {
        this.track(Events.EVENT_AUTH_MODAL_OPENED, { source: 'agent_files' });
        this.repository.authViewModelRepository.setCurrentView('login');
    };

    onFilesAdded = async (
        files: File[],
        method: 'picker' | 'drop'
    ): Promise<void> => {
        // бросить файл в зону гость может и без клика
        if (!this.repository.userViewModelRepository.isAuthenticated()) {
            this.onGuestFileAttempt();
            return;
        }
        const uploaded = await this.fileManagerService.onUploadFiles(
            files,
            ROOT_FOLDER,
            method,
            'agent_chat'
        );
        if (uploaded.length === 0) {
            return;
        }
        const chat = this.repository.chatViewModelRepository;
        chat.setRecentFiles([
            ...[...uploaded].reverse(),
            ...chat.recentFiles().filter((name) => !uploaded.includes(name)),
        ]);
        this.appendMentions(uploaded.filter(isMentionedOnUpload));
    };

    onFileMentioned = (name: string): void => {
        this.track(Events.EVENT_AGENT_FILE_MENTIONED, {
            extension: name.includes('.')
                ? name.slice(name.lastIndexOf('.') + 1).toLowerCase()
                : '',
        });
        this.appendMentions([name]);
    };

    private appendMentions(names: string[]) {
        if (names.length === 0) {
            return;
        }
        const chat = this.repository.chatViewModelRepository;
        const template = this.repository.dictionary.agent_chat.files.mention;
        const mentions = names.map((name) => template.replace('{name}', name));
        const typed = chat.input().replace(/\s+$/, '');
        chat.setInput([typed, ...mentions].filter(Boolean).join('\n'));
    }
}
