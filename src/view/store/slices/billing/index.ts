import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { BillingPricingResponse } from '../../../../model/rpi';
import {
    BillingPricingRequestState,
    BillingPurchaseRequestState,
    billingInitialState,
} from '../index.ts';

export const billingSlice = createSlice({
    name: 'billingSlice',
    initialState: billingInitialState,
    reducers: {
        setBillingPricing: (
            state,
            { payload }: PayloadAction<BillingPricingResponse | undefined>
        ) => {
            state.pricing = payload;
        },
        setBillingPricingRequestState: (
            state,
            { payload }: PayloadAction<BillingPricingRequestState>
        ) => {
            state.pricingRequestState = payload;
        },
        setBillingPaymentWidgetToken: (
            state,
            { payload }: PayloadAction<string | undefined>
        ) => {
            state.paymentWidgetToken = payload;
        },
        setBillingPurchaseRequestState: (
            state,
            { payload }: PayloadAction<BillingPurchaseRequestState>
        ) => {
            state.purchaseRequestState = payload;
        },
    },
});

export const {
    setBillingPricing,
    setBillingPricingRequestState,
    setBillingPaymentWidgetToken,
    setBillingPurchaseRequestState,
} = billingSlice.actions;
