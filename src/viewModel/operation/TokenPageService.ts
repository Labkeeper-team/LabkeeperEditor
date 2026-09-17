import { Rpi } from '../../model/rpi';
import {
    Events,
    ObserverService,
} from '../../model/service/ObserverService.ts';
import { ViewModelRepository } from '../repository';
import { Routes } from '../routes.ts';
import { reportUnexpectedError } from '../utils/reportUnexpectedError.ts';
import { trackEvent } from '../utils/observerContext.ts';

export class TokenPageService {
    rpi: Rpi;
    repository: ViewModelRepository;
    observerService: ObserverService;
    private lastTokenPriceId?: string;

    constructor(
        rpi: Rpi,
        repository: ViewModelRepository,
        observerService: ObserverService
    ) {
        this.rpi = rpi;
        this.repository = repository;
        this.observerService = observerService;
    }

    private track(event: string, properties?: Record<string, unknown>) {
        trackEvent(this.observerService, this.repository, event, properties);
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
        this.lastTokenPriceId = tokenPriceId;
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
                this.track(Events.EVENT_PAYMENT_STARTED, {
                    token_price_id: tokenPriceId,
                });
                this.repository.setLocation(Routes.Pay);
                return;
            }
            reportUnexpectedError(
                this.observerService,
                'billing.purchase_missing_token',
                new Error('Billing purchase succeeded without widget token')
            );
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
        this.track(Events.EVENT_PAYMENT_SUCCESS, {
            ...(this.lastTokenPriceId
                ? { token_price_id: this.lastTokenPriceId }
                : {}),
        });
        this.lastTokenPriceId = undefined;
        await this.refreshUserInfo();
        this.repository.billingViewModelRepository.setPaymentWidgetToken(
            undefined
        );
        this.repository.billingViewModelRepository.setPurchaseRequestState(
            'idle'
        );
        this.repository.setLocation(Routes.Tokens);
    };

    onPaymentWidgetFailed = (): void => {
        this.track(Events.EVENT_PAYMENT_WIDGET_FAILED);
        reportUnexpectedError(
            this.observerService,
            'billing.widget',
            new Error('YooKassa widget failed')
        );
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
        }
    };
}
