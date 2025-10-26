import { memo } from 'react';

export const Plotname = memo(({ name }: { name?: string }) => {
    if (!name) {
        return null;
    }
    return <div className="plot-title">$${name.replaceAll(' ', '\\:')}$$</div>;
});
