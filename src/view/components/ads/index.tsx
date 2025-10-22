import { useEffect } from 'react';

export const YandexRtbBanner = (props: {
    width: number;
    height: number;
    blockId: string;
}) => {
    useEffect(() => {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const w = window as any;
            w.yaContextCb = w.yaContextCb || [];
            w.yaContextCb.push(() => {
                w.Ya?.Context?.AdvManager?.render({
                    blockId: props.blockId,
                    renderTo: `yandex_rtb_${props.blockId}`,
                });
            });
        } finally {
            /* empty */
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div
            style={{
                display: 'flex',
                justifyContent: 'center',
                marginTop: '0',
            }}
        >
            <div
                id={`yandex_rtb_${props.blockId}`}
                style={{ width: props.width, height: props.height }}
            />
        </div>
    );
};

export const YandexRtbFloorAd = (blockId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    w.yaContextCb = w.yaContextCb || [];
    w.yaContextCb.push(() => {
        w.Ya?.Context?.AdvManager?.render({
            blockId: blockId,
            type: 'floorAd',
            platform: 'desktop',
        });
    });
};
