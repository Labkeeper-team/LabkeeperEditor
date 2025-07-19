import { ViewModelState } from './viewModelState';

export class AuthService {
    vms: ViewModelState;

    constructor(vms: ViewModelState) {
        this.vms = vms;
    }

    restartPasswordPipeline = () => {
        this.vms.authViewModelState.setEmailRequest('unknown');
        this.vms.authViewModelState.setPasswordRequest('unknown');
        this.vms.authViewModelState.setCodeCheckRequest('unknown');
        this.vms.authViewModelState.setCurrentEmail(null);
        this.vms.authViewModelState.setLastVerifiedCode(null);
    };
}
