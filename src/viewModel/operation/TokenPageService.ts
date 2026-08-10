import { Rpi } from '../../model/rpi';
import {
    Events,
    ObserverService,
} from '../../model/service/ObserverService.ts';
import { ViewModelRepository } from '../repository';
import { Routes } from '../routes.ts';

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

    resetBillingPurchaseFlow = () => {
        this.repository.billingViewModelRepository.setPaymentWidgetToken(
            undefined
        );
        this.repository.billingViewModelRepository.setPurchaseRequestState(
            'idle'
        );
    };

    onBillingPurchaseCreate = async (tokenPriceId: string): Promise<void> => {
        this.repository.billingViewModelRepository.setPaymentWidgetToken(
            undefined
        );
        this.repository.billingViewModelRepository.setPurchaseRequestState(
            'loading'
        );

        const result =
            await this.rpi.createBillingPurchaseRequest(tokenPriceId);
        if (result.isOk) {
            const widgetToken =
                result.body.token ?? result.body.yookassa.widgetToken;
            if (widgetToken) {
                this.repository.billingViewModelRepository.setPaymentWidgetToken(
                    widgetToken
                );
                this.repository.billingViewModelRepository.setPurchaseRequestState(
                    'ok'
                );
                this.repository.setLocation(Routes.Pay);
                return;
            }
        }

        this.repository.billingViewModelRepository.setPurchaseRequestState(
            'error'
        );
    };

    restorePendingPurchaseForPayPage = async (): Promise<boolean> => {
        const result = await this.rpi.listBillingPurchasesRequest({
            page: 0,
            size: 1,
            status: 'pending',
        });

        if (!result.isOk) {
            return false;
        }

        const purchase = result.body.purchases[0];
        if (!purchase) {
            return false;
        }

        const widgetToken = purchase.token ?? purchase.yookassa.widgetToken;
        if (!widgetToken) {
            return false;
        }

        this.repository.billingViewModelRepository.setPaymentWidgetToken(
            widgetToken
        );
        return true;
    };

    onPaymentStatusChanged = async () => {
        await this.refreshUserInfo();
        this.repository.billingViewModelRepository.setPaymentWidgetToken(
            undefined
        );
        this.repository.billingViewModelRepository.setPurchaseRequestState(
            'idle'
        );
        this.repository.setLocation(Routes.Tokens);
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
