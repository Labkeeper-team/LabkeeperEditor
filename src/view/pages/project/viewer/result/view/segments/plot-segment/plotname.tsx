import { MathJax } from 'better-react-mathjax';
import { memo } from 'react';

export const Plotname = memo(({ name }: { name?: string }) => {
    if (!name) {
        return null;
    }
    return (
        <div className="plot-title">
            <MathJax>$${name.replaceAll(' ', '\\:')}$$</MathJax>
        </div>
    );
});
