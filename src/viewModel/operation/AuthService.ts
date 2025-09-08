import { Routes } from '../routes.ts';
import { ViewModelRepository } from '../repository';
import { Rpi } from '../../model/rpi';
import { IdeService } from '../domain/IdeService.ts';
import { StartupService } from './StartupService.ts';

export class AuthService {
    repository: ViewModelRepository;
    rpi: Rpi;
    ideService: IdeService;
    startupService: StartupService;

    constructor(
        repository: ViewModelRepository,
        rpi: Rpi,
        ideService: IdeService,
        startupService: StartupService
    ) {
        this.rpi = rpi;
        this.ideService = ideService;
        this.repository = repository;
        this.startupService = startupService;
    }

    onFormLoginClicked = async (
        userName: string,
        password: string,
        captcha: string
    ) => {
        this.repository.authViewModelRepository.setLoginRequest('loading');
        const response = await this.rpi.formLoginRequest(
            userName,
            password,
            captcha
        );

        if (response.isOk) {
            this.repository.authViewModelRepository.setLoginRequest('ok');
            await this.startupService.onAppStartup();
            this.repository.authViewModelRepository.setCurrentView('closed');
        } else if (response.code === 401) {
            this.repository.authViewModelRepository.setLoginRequest(
                'bad_credentials'
            );
        } else {
            this.repository.authViewModelRepository.setLoginRequest(
                'unknownError'
            );
        }
    };

    onOauthLogin = async () => {
        this.repository.persistenceViewModelRepository.setLastOpenedProjectUuid(
            this.repository.projectViewModelRepository.project()?.projectId
        );
    };

    onLogoutButtonClicked = async () => {
        const response = await this.rpi.logoutRequest();

        if (response.isOk) {
            this.ideService.resetEditor();
            this.repository.navigate(Routes.ProjectDefault);
            this.repository.projectViewModelRepository.setReadOnly(false);
        }
    };

    onAuthButtonClicked = async () => {
        this.repository.authViewModelRepository.setCurrentView('login');
        this.restartPasswordPipeline();
    };

    onAuthClosed = async () => {
        this.repository.authViewModelRepository.setCurrentView('closed');
        this.restartPasswordPipeline();
    };

    onRegistrationButtonClicked = async () => {
        this.repository.authViewModelRepository.setCurrentView('email');
        this.repository.authViewModelRepository.setIsRegistration(true);
        this.restartPasswordPipeline();
    };

    onForgotPasswordButtonClicked = async () => {
        this.repository.authViewModelRepository.setCurrentView('email');
        this.repository.authViewModelRepository.setIsRegistration(false);
        this.restartPasswordPipeline();
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

        if (result.isOk) {
            this.repository.authViewModelRepository.setEmailRequest('ok');
            this.repository.authViewModelRepository.setCurrentEmail(email);
            this.repository.authViewModelRepository.setCurrentView('code');
        } else if (result.code === 404) {
            this.repository.authViewModelRepository.setEmailRequest(
                'userNotFound'
            );
        } else if (result.code === 409) {
            this.repository.authViewModelRepository.setEmailRequest(
                'userExists'
            );
        } else if (result.code === 400) {
            this.repository.authViewModelRepository.setEmailRequest(
                'validationError'
            );
        } else {
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

        if (result.isOk) {
            this.repository.authViewModelRepository.setPasswordRequest('ok');
            this.repository.authViewModelRepository.setCurrentView('success');
        } else if (result.code === 404) {
            this.repository.authViewModelRepository.setPasswordRequest(
                'userNotFound'
            );
        } else if (result.code === 409) {
            this.repository.authViewModelRepository.setPasswordRequest(
                'userExists'
            );
        } else if (result.code === 400) {
            this.repository.authViewModelRepository.setPasswordRequest(
                'validationError'
            );
        } else {
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

        if (result.isOk) {
            this.repository.authViewModelRepository.setCodeCheckRequest('ok');
            this.repository.authViewModelRepository.setLastVerifiedCode(code);
            this.repository.authViewModelRepository.setCurrentView('password');
        } else {
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
}
