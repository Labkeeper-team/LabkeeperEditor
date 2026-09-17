import { Routes } from '../routes.ts';
import { ViewModelRepository } from '../repository';
import { Rpi } from '../../model/rpi';
import { IdeService } from '../domain/IdeService.ts';
import { StartupService } from './StartupService.ts';
import {
    Events,
    ObserverService,
} from '../../model/service/ObserverService.ts';
import { trackEvent } from '../utils/observerContext.ts';

export class AuthService {
    repository: ViewModelRepository;
    rpi: Rpi;
    ideService: IdeService;
    startupService: StartupService;
    observerService: ObserverService;

    constructor(
        repository: ViewModelRepository,
        rpi: Rpi,
        ideService: IdeService,
        startupService: StartupService,
        observerService: ObserverService
    ) {
        this.rpi = rpi;
        this.ideService = ideService;
        this.repository = repository;
        this.startupService = startupService;
        this.observerService = observerService;
    }

    private track(event: string, properties?: Record<string, unknown>) {
        trackEvent(this.observerService, this.repository, event, properties);
    }

    private authFlow() {
        return this.repository.authViewModelRepository.isRegistration()
            ? 'registration'
            : 'reset';
    }

    onFormLoginClicked = async (
        userName: string,
        password: string,
        captcha?: string
    ) => {
        this.repository.authViewModelRepository.setLoginRequest('loading');
        const captchaBypassToken =
            this.repository.settingsViewModelRepository.captchaBypassToken();
        let captchaRequest: string | undefined = undefined;

        if (captcha) {
            captchaRequest = captcha;
        }

        if (captchaBypassToken) {
            captchaRequest = captchaBypassToken;
        }

        if (!captchaRequest) {
            throw Error('Captcha token not provided');
        }

        this.track(Events.EVENT_LOGIN_SUBMITTED, { method: 'password' });

        const response = await this.rpi.formLoginRequest(
            userName,
            password,
            captchaRequest
        );

        if (response.isOk) {
            this.track(Events.EVENT_LOGIN_SUCCEEDED, { method: 'password' });
            this.repository.authViewModelRepository.setCurrentView('closed');
            this.repository.authViewModelRepository.setLoginRequest('ok');
            await this.startupService.onAppStartup();
        } else if (response.code === 401) {
            this.track(Events.EVENT_LOGIN_FAILED, {
                method: 'password',
                reason: 'bad_credentials',
            });
            this.repository.authViewModelRepository.setLoginRequest(
                'bad_credentials'
            );
        } else {
            this.track(Events.EVENT_LOGIN_FAILED, {
                method: 'password',
                reason: 'unknown',
            });
            this.repository.authViewModelRepository.setLoginRequest(
                'unknownError'
            );
        }
    };

    onOauthLogin = async () => {
        this.track(Events.EVENT_OAUTH_STARTED, { provider: 'yandex' });
        this.repository.persistenceViewModelRepository.setLastOpenedProjectUuid(
            this.repository.projectViewModelRepository.project()?.projectId
        );
    };

    onLogoutButtonClicked = async () => {
        const response = await this.rpi.logoutRequest();

        if (response.isOk) {
            this.track(Events.EVENT_LOGOUT_CONFIRMED);
            const pathname = this.normalizeLocationPath(
                this.repository.location()
            );
            this.ideService.resetEditor();
            const stayAfterLogout =
                pathname === Routes.Tokens || pathname === Routes.Home;
            if (!stayAfterLogout) {
                this.repository.setLocation(Routes.ProjectDefault);
            }
            this.repository.projectViewModelRepository.setReadOnly(false);
        }
    };

    private normalizeLocationPath = (path: string) => {
        if (path === '' || path === '/') {
            return Routes.Home;
        }
        return path.endsWith('/') ? path.slice(0, -1) : path;
    };

    onAuthButtonClicked = async (source?: string) => {
        this.restartLoginPipeline();
        this.repository.authViewModelRepository.setCurrentView('login');
        this.restartPasswordPipeline();
        this.track(Events.EVENT_AUTH_MODAL_OPENED, {
            ...(source ? { source } : {}),
        });
    };

    onAuthClosed = async (interrupted = false) => {
        const view = this.repository.authViewModelRepository.currentView();
        this.track(Events.EVENT_AUTH_MODAL_CLOSED, {
            view,
            interrupted,
        });
        this.repository.authViewModelRepository.setCurrentView('closed');
        this.restartLoginPipeline();
        this.restartPasswordPipeline();
    };

    onRegistrationButtonClicked = async () => {
        this.restartLoginPipeline();
        this.repository.authViewModelRepository.setCurrentView('email');
        this.repository.authViewModelRepository.setIsRegistration(true);
        this.restartPasswordPipeline();
        this.track(Events.EVENT_REGISTRATION_STARTED);
    };

    onForgotPasswordButtonClicked = async () => {
        this.restartLoginPipeline();
        this.repository.authViewModelRepository.setCurrentView('email');
        this.repository.authViewModelRepository.setIsRegistration(false);
        this.restartPasswordPipeline();
        this.track(Events.EVENT_FORGOT_PASSWORD_STARTED);
    };

    onEmailSendButtonClicked = async (email: string, captcha: string) => {
        this.repository.authViewModelRepository.setCurrentEmail(null);
        this.repository.authViewModelRepository.setEmailRequest('loading');
        const result = await this.rpi.sendEmailWithCodeRequest(
            email,
            this.repository.authViewModelRepository.isRegistration(),
            this.repository.persistenceViewModelRepository.language(),
            captcha
        );

        const flow = this.authFlow();
        if (result.isOk) {
            this.track(Events.EVENT_AUTH_EMAIL_SENT, { flow, ok: true });
            this.repository.authViewModelRepository.setEmailRequest('ok');
            this.repository.authViewModelRepository.setCurrentEmail(email);
            this.repository.authViewModelRepository.setCurrentView('code');
        } else if (result.code === 404) {
            this.track(Events.EVENT_AUTH_EMAIL_SENT, {
                flow,
                ok: false,
                reason: 'userNotFound',
            });
            this.repository.authViewModelRepository.setEmailRequest(
                'userNotFound'
            );
        } else if (result.code === 409) {
            this.track(Events.EVENT_AUTH_EMAIL_SENT, {
                flow,
                ok: false,
                reason: 'userExists',
            });
            this.repository.authViewModelRepository.setEmailRequest(
                'userExists'
            );
        } else if (result.code === 400) {
            this.track(Events.EVENT_AUTH_EMAIL_SENT, {
                flow,
                ok: false,
                reason: 'validationError',
            });
            this.repository.authViewModelRepository.setEmailRequest(
                'validationError'
            );
        } else {
            this.track(Events.EVENT_AUTH_EMAIL_SENT, {
                flow,
                ok: false,
                reason: 'unknown',
            });
            this.repository.authViewModelRepository.setEmailRequest(
                'unknownError'
            );
        }
    };

    onSendPasswordButtonClicked = async (password: string) => {
        this.repository.authViewModelRepository.setPasswordRequest('loading');
        const result = await this.rpi.setPasswordRequest(
            this.repository.authViewModelRepository.currentEmail() || '',
            this.repository.authViewModelRepository.lastVerifiedCode() || '',
            password,
            this.repository.authViewModelRepository.isRegistration()
        );

        const flow = this.authFlow();
        if (result.isOk) {
            this.track(Events.EVENT_AUTH_PASSWORD_SET, { flow, ok: true });
            this.repository.authViewModelRepository.setPasswordRequest('ok');
            this.repository.authViewModelRepository.setCurrentView('success');
        } else if (result.code === 404) {
            this.track(Events.EVENT_AUTH_PASSWORD_SET, {
                flow,
                ok: false,
                reason: 'userNotFound',
            });
            this.repository.authViewModelRepository.setPasswordRequest(
                'userNotFound'
            );
        } else if (result.code === 409) {
            this.track(Events.EVENT_AUTH_PASSWORD_SET, {
                flow,
                ok: false,
                reason: 'userExists',
            });
            this.repository.authViewModelRepository.setPasswordRequest(
                'userExists'
            );
        } else if (result.code === 400) {
            this.track(Events.EVENT_AUTH_PASSWORD_SET, {
                flow,
                ok: false,
                reason: 'validationError',
            });
            this.repository.authViewModelRepository.setPasswordRequest(
                'validationError'
            );
        } else {
            this.track(Events.EVENT_AUTH_PASSWORD_SET, {
                flow,
                ok: false,
                reason: 'unknown',
            });
            this.repository.authViewModelRepository.setPasswordRequest(
                'unknownError'
            );
        }
    };

    onSendCodeButtonClicked = async (code: string) => {
        this.repository.authViewModelRepository.setLastVerifiedCode(null);
        this.repository.authViewModelRepository.setCodeCheckRequest('loading');
        const result = await this.rpi.checkCodeRequest(
            this.repository.authViewModelRepository.currentEmail() || '',
            code
        );

        const flow = this.authFlow();
        if (result.isOk && result.body.valid) {
            this.track(Events.EVENT_AUTH_CODE_SUBMITTED, { flow, ok: true });
            this.repository.authViewModelRepository.setCodeCheckRequest('ok');
            this.repository.authViewModelRepository.setLastVerifiedCode(code);
            this.repository.authViewModelRepository.setCurrentView('password');
        } else {
            this.track(Events.EVENT_AUTH_CODE_SUBMITTED, {
                flow,
                ok: false,
                reason: 'invalid',
            });
            this.repository.authViewModelRepository.setCodeCheckRequest(
                'invalid'
            );
        }
    };

    private restartPasswordPipeline = () => {
        this.repository.authViewModelRepository.setEmailRequest('unknown');
        this.repository.authViewModelRepository.setPasswordRequest('unknown');
        this.repository.authViewModelRepository.setCodeCheckRequest('unknown');
        this.repository.authViewModelRepository.setCurrentEmail(null);
        this.repository.authViewModelRepository.setLastVerifiedCode(null);
    };

    private restartLoginPipeline = () => {
        this.repository.authViewModelRepository.setLoginRequest('unknown');
    };
}
