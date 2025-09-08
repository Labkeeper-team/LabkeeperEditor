import { ViewModelRepository } from './repository';

export class AuthService {
    repository: ViewModelRepository;

    constructor(repository: ViewModelRepository) {
        this.repository = repository;
    }

    restartPasswordPipeline = () => {
        this.repository.authViewModelRepository.setEmailRequest('unknown');
        this.repository.authViewModelRepository.setPasswordRequest('unknown');
        this.repository.authViewModelRepository.setCodeCheckRequest('unknown');
        this.repository.authViewModelRepository.setCurrentEmail(null);
        this.repository.authViewModelRepository.setLastVerifiedCode(null);
    };
}
