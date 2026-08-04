import { BillingPurchaseResponse, RequestResult, Rpi } from '../../model/rpi';
import {
    Events,
    ObserverService,
} from '../../model/service/ObserverService.ts';
import { ViewModelRepository } from '../repository';

export class TokenPageService {
    rpi: Rpi;
    repository: ViewModelRepository;
    observerService: ObserverService;

    constructor(
        rpi: Rpi,
        repository: ViewModelRepository,
        observerService: ObserverService
    ) {
        this.rpi = rpi;
        this.repository = repository;
        this.observerService = observerService;
    }

    onBillingPurchaseCreate = async (
        tokenPriceId: string
    ): Promise<RequestResult<BillingPurchaseResponse>> =>
        this.rpi.createBillingPurchaseRequest(tokenPriceId);

    onPaymentStatusChanged = async () => {
        await this.refreshUserInfo();
    };

    refreshUserInfo = async () => {
        if (!this.repository.userViewModelRepository.isAuthenticated()) {
            return;
        }

        const result = await this.rpi.getUserInfoRequest();
        if (result.isOk) {
            this.repository.userViewModelRepository.setUserInfo(result.body);
            this.repository.settingsViewModelRepository.setShowPrivacyPolicyAcceptanceModal(
                result.body.isAuthenticated &&
                    !result.body.privacyPolicyAccepted
            );
        } else {
            this.observerService.onEvent(
                Events.EVENT_RPI_UNKNOWN_REFRESH_USER_INFO
            );
        }
    };
}
