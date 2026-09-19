import { OpenPanel } from '@openpanel/web';
import type { Event as SentryEvent } from '@sentry/react';
import { Secrets } from '../../constants.ts';
import {
    OPENPANEL_EVENT_NAMES,
    ObserverEventProperties,
    ObserverService,
} from '../../model/service/ObserverService.ts';
import { logBreadcrumb } from '../../viewModel/utils/logBreadcrumb.ts';
import { reportToSentry } from '../../viewModel/utils/reportUnexpectedError.ts';
import { sentryIssueSearchUrl } from '../sentry/sentryUrl.ts';
import {
    adoptAnalyticsSessionId,
    createGuestSessionId,
    getSessionId,
    resetSessionIdOnLogout,
} from '../session.ts';

const SESSION_TIMEOUT_MS = 2000;
const EDITOR_EVENT_PREFIX = '[E] ';

function anonymousDisplayName(): string {
    const suffix = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
    return `anonymous${String(suffix).padStart(6, '0')}`;
}

export class OpenPanelService implements ObserverService {
    private op: OpenPanel | undefined;
    // промис сетевой части старта, он же признак начатой сессии: отдельного флага нет,
    // иначе вход, пришедший до конца первой инициализации, уехал бы мимо неё
    private starting: Promise<void> | undefined;
    // профиль, от имени которого вкладка работает сейчас: хвост первой инициализации доходит
    // до сети уже после входа или выхода, и представляться устаревшим профилем ему нельзя
    private currentProfileId: string | undefined;

    async init(userId?: string, email?: string) {
        if (!this.ensureClient() || !this.op) {
            return;
        }
        // профиль отдаём SDK синхронно: запроса при одном ключе он не делает, зато все
        // дальнейшие события уже несут profileId, а гость сразу получает значение заголовка
        const profileId = userId ?? createGuestSessionId();
        this.currentProfileId = profileId;
        void this.op.identify({ profileId });
        if (!this.starting) {
            this.starting = this.startSession(profileId, userId, email);
        } else if (userId) {
            // вход мог прийти, пока первая сессия ещё в полёте: представляем пользователя после неё
            this.starting = this.starting.then(() =>
                this.identify(userId, { email })
            );
        }
        await this.starting;
    }

    onLogout() {
        if (!this.ensureClient() || !this.op) {
            return;
        }
        // после выхода вкладка продолжает работу как гостевая, и профиль в SDK тоже гостевой
        const profileId = resetSessionIdOnLogout();
        this.currentProfileId = profileId;
        void this.op.identify({ profileId });
    }

    onEvent(event: string, properties?: ObserverEventProperties) {
        if (!this.ensureClient() || !this.op) {
            return;
        }
        const name = OPENPANEL_EVENT_NAMES[event] ?? event;
        void Promise.resolve(this.track(name, properties)).catch((error) => {
            logBreadcrumb('openpanel', 'event track failed', { error, event });
        });
    }

    setUserState() {}

    trackSentryEvent(event: SentryEvent) {
        if (!this.ensureClient() || !this.op) {
            return;
        }
        const eventId = event.event_id?.trim();
        if (!eventId) {
            return;
        }
        void Promise.resolve(
            this.track('Error reported to sentry', {
                event_id: eventId,
                sentry_url: sentryIssueSearchUrl(Secrets.sentryDsn, eventId),
                level: event.level,
                message: event.message || event.exception?.values?.[0]?.value,
            })
        ).catch((error) => {
            logBreadcrumb('openpanel', 'sentry track failed', { error });
        });
    }

    private track(name: string, properties?: Record<string, unknown>) {
        if (!this.op) {
            return Promise.resolve(undefined);
        }
        return this.op.track(`${EDITOR_EVENT_PREFIX}${name}`, properties);
    }

    private ensureClient(): boolean {
        if (this.op) {
            return true;
        }
        const clientId = configuredSecret(Secrets.openpanelClientId);
        const apiUrl = configuredSecret(Secrets.openpanelApiUrl);
        if (!clientId || !apiUrl) {
            return false;
        }
        this.op = new OpenPanel({
            clientId,
            apiUrl,
            trackScreenViews: false,
            trackOutgoingLinks: false,
        });
        return true;
    }

    private async startSession(
        profileId: string,
        userId?: string,
        email?: string
    ) {
        if (!this.op) {
            return;
        }
        let startError: unknown;
        try {
            const result = await withTimeout(
                this.track('Session started', {
                    __path: window.location.pathname,
                    __title: document.title,
                    profileId,
                }),
                SESSION_TIMEOUT_MS,
                'session start'
            );
            // у гостя заголовок уже равен локальному profileId, серверный id берём только у вошедшего
            if (userId) {
                adoptAnalyticsSessionId(result?.sessionId);
            }
        } catch (error) {
            startError = error;
            logBreadcrumb('openpanel', 'session start failed', { error });
        }
        // повтора старта не будет, поэтому вошедшему без серверного id выдаём локальный:
        // иначе вкладка до закрытия ходит без заголовка, а отчёт делает отказ видимым
        if (userId && !getSessionId()) {
            createGuestSessionId();
            reportToSentry('openpanel.sessionStart', startError);
        }
        // представляемся даже после сорванного Session started: это независимый запрос
        if (userId) {
            await this.identify(userId, { email });
        } else {
            await this.identify(profileId, {
                firstName: anonymousDisplayName(),
            });
        }
    }

    private async identify(
        profileId: string,
        options?: { email?: string; firstName?: string }
    ) {
        // профиль сменился, пока хвост старта ждал сеть: возвращать в SDK ушедшего
        // пользователя или заводить анонимный профиль уже вошедшему нельзя
        if (!this.op || profileId !== this.currentProfileId) {
            return;
        }
        const payload = {
            profileId,
            ...(options?.email ? { email: options.email } : {}),
            ...(options?.firstName ? { firstName: options.firstName } : {}),
        };
        try {
            // без таймаута ретраи SDK держат промис до 3.5 секунды, и отменить их нечем
            await withTimeout(
                Promise.resolve(this.op.identify(payload)),
                SESSION_TIMEOUT_MS,
                'identify'
            );
        } catch (error) {
            logBreadcrumb('openpanel', 'identify failed', { error });
        }
    }
}

function configuredSecret(value: string | undefined): string {
    if (!value || value.startsWith('IO_LABKEEPER_FRONTEND_')) {
        return '';
    }
    return value.trim();
}

function withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    label: string
): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => {
            reject(new Error(`OpenPanel ${label} timed out after ${ms}ms`));
        }, ms);
        promise.then(
            (value) => {
                window.clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                window.clearTimeout(timer);
                reject(error);
            }
        );
    });
}
