import { useEffect, useMemo } from 'react';

const YOOMONEY_CHECKOUT_WIDGET_SCRIPT_SRC =
    'https://yookassa.ru/checkout-widget/v1/checkout-widget.js';

type YooMoneyErrorCallbackResult = {
    error: string;
};

type YooMoneyCheckoutWidgetConfig = {
    confirmation_token: string;
    error_callback: (result: YooMoneyErrorCallbackResult) => void;
    customization?: {
        modal?: boolean;
        colors?: {
            control_primary?: string;
            control_primary_content?: string;
        };
    };
};

type YooMoneyCheckoutWidgetInstance = {
    on: (
        eventName: 'success' | 'fail' | 'complete',
        callback: (result: { status: string }) => void
    ) => void;
    render: (id?: string) => Promise<undefined>;
    destroy: () => void;
};

type YooMoneyCheckoutWidgetConstructor = new (
    config: YooMoneyCheckoutWidgetConfig
) => YooMoneyCheckoutWidgetInstance;

declare global {
    interface Window {
        YooMoneyCheckoutWidget?: YooMoneyCheckoutWidgetConstructor;
    }
}

let checkoutWidgetScriptPromise: Promise<void> | null = null;

const createPaymentFormId = (): string => {
    const randomValue =
        typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2);

    return `yoomoney-payment-form-${randomValue}`;
};

const loadCheckoutWidgetScript = (): Promise<void> => {
    if (window.YooMoneyCheckoutWidget) {
        return Promise.resolve();
    }

    if (!checkoutWidgetScriptPromise) {
        checkoutWidgetScriptPromise = new Promise((resolve, reject) => {
            const existingScript = document.querySelector<HTMLScriptElement>(
                `script[src="${YOOMONEY_CHECKOUT_WIDGET_SCRIPT_SRC}"]`
            );

            if (existingScript) {
                existingScript.addEventListener('load', () => resolve(), {
                    once: true,
                });
                existingScript.addEventListener('error', () => reject(), {
                    once: true,
                });
                return;
            }

            const script = document.createElement('script');
            script.src = YOOMONEY_CHECKOUT_WIDGET_SCRIPT_SRC;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject();
            document.head.appendChild(script);
        });
    }

    return checkoutWidgetScriptPromise;
};

type YooMoneyCheckoutWidgetProps = {
    config: YooMoneyCheckoutWidgetConfig;
    onComplete?: () => void;
    onFail?: () => void;
};

export const YooMoneyCheckoutWidget = ({
    config,
    onComplete,
    onFail,
}: YooMoneyCheckoutWidgetProps) => {
    const containerId = useMemo(() => createPaymentFormId(), []);

    useEffect(() => {
        let isDestroyed = false;
        let checkout: YooMoneyCheckoutWidgetInstance | null = null;

        const destroyCheckout = () => {
            checkout?.destroy();
            checkout = null;
        };

        loadCheckoutWidgetScript()
            .then(() => {
                if (isDestroyed) {
                    return;
                }

                if (!window.YooMoneyCheckoutWidget) {
                    config.error_callback({ error: 'script_load_error' });
                    return;
                }

                checkout = new window.YooMoneyCheckoutWidget(config);
                checkout.on('complete', () => {
                    onComplete?.();
                    destroyCheckout();
                });
                checkout.on('fail', () => {
                    onFail?.();
                    destroyCheckout();
                });
                void checkout.render(containerId);
            })
            .catch(() => config.error_callback({ error: 'script_load_error' }));

        return () => {
            isDestroyed = true;
            destroyCheckout();
        };
    }, [config, containerId, onComplete, onFail]);

    return <div id={containerId} />;
};
