import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { BillingPricingResponse } from '../../../../model/rpi';
import { BillingPricingRequestState, billingInitialState } from '../index.ts';

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
    },
});

export const { setBillingPricing, setBillingPricingRequestState } =
    billingSlice.actions;
