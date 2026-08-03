import { BillingPurchaseResponse, RequestResult, Rpi } from '../../model/rpi';

export class TokenPageService {
    rpi: Rpi;

    constructor(rpi: Rpi) {
        this.rpi = rpi;
    }

    onBillingPurchaseCreate = async (
        tokenPriceId: string
    ): Promise<RequestResult<BillingPurchaseResponse>> =>
        this.rpi.createBillingPurchaseRequest(tokenPriceId);
}
