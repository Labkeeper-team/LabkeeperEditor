import { forwardRef, useCallback, useEffect } from 'react';
import { PlotDto } from '../../../../../../../../model/domain';
import classNames from 'classnames';
import { MathJax } from 'better-react-mathjax';
export type LegendPosition = 'bottom' | 'right';

export interface LegendProps {
    show: boolean;
    plots: PlotDto[];
    handleLegendClick: (name: string) => void;
    seriesVisibility: Record<string, boolean>;
    legendPosition: LegendPosition;
    setLegendPosition: (newPosition: LegendPosition) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    containerRef: any;
}

export const Legend = forwardRef<HTMLDivElement, LegendProps>(
    (
        {
            show,
            plots,
            handleLegendClick,
            seriesVisibility,
            containerRef,
            legendPosition,
            setLegendPosition,
        },
        legendRef
    ) => {
        // Функция для проверки размера легенды и определения позиции
        const checkLegendSize = useCallback(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const lRef: any = legendRef;
            if (!lRef?.current) return;

            const legendWidth = lRef.current.offsetWidth;
            if (legendWidth > 120) {
                setLegendPosition('bottom');
            } else {
                setLegendPosition('right');
            }
        }, [legendRef, setLegendPosition]);

        useEffect(() => {
            checkLegendSize();
            const resizeObserver = new ResizeObserver(checkLegendSize);
            if (containerRef.current) {
                resizeObserver.observe(containerRef.current);
            }

            return () => {
                resizeObserver.disconnect();
            };
        }, [plots, containerRef, checkLegendSize, legendPosition]);

        if (!show) {
            return null;
        }

        return (
            <div
                ref={legendRef}
                className={classNames('custom-legend', legendPosition)}
                style={legendPosition === 'bottom' ? { bottom: 0 } : undefined}
            >
                {plots.map((plot, idx) => {
                    const isVisible = seriesVisibility[plot.name];
                    return (
                        <div
                            key={idx}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '2px',
                                cursor: 'pointer',
                                opacity: isVisible ? 1 : 0.4,
                                transition: 'opacity 0.2s',
                            }}
                            onClick={() => handleLegendClick(plot.name)}
                        >
                            <span
                                style={{
                                    display: 'inline-block',
                                    width: 20,
                                    height: plot.type === 'histogram' ? 12 : 2,
                                    backgroundColor: isVisible
                                        ? plot.color
                                        : '#ccc',
                                    borderRadius:
                                        plot.type === 'scatter' ? '50%' : 0,
                                    flexShrink: 0,
                                    transition: 'background-color 0.2s',
                                }}
                            />
                            <span
                                style={{
                                    color: isVisible ? 'inherit' : '#999',
                                    transition: 'color 0.2s',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                <MathJax>$${plot.name.replaceAll(' ', '\\:')}$$</MathJax>
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    }
);
