import { useCallback, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { controller } from '../../../main.tsx';
import { AppDispatch } from '../../store';
import { useBillingPaymentWidgetToken } from '../../store/selectors/program';
import { useDictionary } from '../../store/selectors/translations';
import { MarketingFooter } from '../../components/header/marketing/MarketingFooter';
import { YooMoneyCheckoutWidget } from './YooMoneyCheckoutWidget.tsx';

import './style.scss';

export const PayPage = () => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const paymentWidgetToken = useSelector(useBillingPaymentWidgetToken);
    const [hasWidgetError, setHasWidgetError] = useState(false);
    const page = dictionary.tokens_page;

    const yoomoneyWidgetConfig = useMemo(
        () =>
            paymentWidgetToken
                ? {
                      confirmation_token: paymentWidgetToken,
                      error_callback: () => setHasWidgetError(true),
                      customization: {
                          modal: false,
                          colors: {
                              control_primary: '#4469E0',
                              control_primary_content: '#FFFFFF',
                          },
                      },
                  }
                : null,
        [paymentWidgetToken]
    );

    const onPaymentComplete = useCallback(async () => {
        await dispatch(controller.onPaymentStatusChangedRequest()).unwrap();
    }, [dispatch]);

    return (
        <>
            <main className="pay-page">
                <section className="pay-page__card">
                    <h1>{page.modal.title}</h1>
                    <p>{page.modal.gateway_notice}</p>
                    {yoomoneyWidgetConfig ? (
                        <div className="pay-page__widget">
                            <YooMoneyCheckoutWidget
                                key={paymentWidgetToken}
                                config={yoomoneyWidgetConfig}
                                onComplete={onPaymentComplete}
                                onFail={() => setHasWidgetError(true)}
                            />
                        </div>
                    ) : null}
                    {hasWidgetError ? (
                        <p className="pay-page__error">
                            {page.modal.widget_error}
                        </p>
                    ) : null}
                </section>
            </main>
            <MarketingFooter />
        </>
    );
};
