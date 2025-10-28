/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import './plot-segment.scss';
import { PlotStatement } from '../../../../../../../../model/domain.ts';
import { Legend, LegendPosition } from './legend.tsx';
import { renderErrorItem } from './helpers/renderErrorItem.ts';
import { Plotname } from './plotname.tsx';

import { MathJax } from 'better-react-mathjax';

export const PlotSegment = ({ statement }: { statement: PlotStatement }) => {
    const chartRef = useRef<ReactECharts | null>(null);
    const legendRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [legendPosition, setLegendPosition] =
        useState<LegendPosition>('right');
    const [seriesVisibility, setSeriesVisibility] = useState<
        Record<string, boolean>
    >(() =>
        statement.plots.reduce(
            (acc, plot) => ({ ...acc, [plot.name]: true }),
            {}
        )
    );

    const option = useMemo(() => {
        const series = statement.plots.map((plot) => {
            let xData: number[] = [];
            let yData: number[] = [];
            if (plot.type !== 'histogram') {
                xData = plot.x.map(Number);
                yData = plot.y?.map(Number);
            } else {
                const hasYData = plot.y && plot.y.length > 0;
                const histFunc = hasYData ? 'sum' : 'count';

                if (plot.x.length < 20) {
                    if (histFunc === 'sum') {
                        const sumMap = plot.x.reduce(
                            (acc, v, idx) => {
                                const num = Number(v);
                                const yVal = Number(plot.y![idx]) || 0;
                                acc[num] = (acc[num] || 0) + yVal;
                                return acc;
                            },
                            {} as Record<number, number>
                        );

                        const uniqueX = Object.keys(sumMap)
                            .map(Number)
                            .sort((a, b) => a - b);
                        xData = uniqueX;
                        yData = uniqueX.map((x) => sumMap[x]);
                    } else {
                        const freqMap = plot.x.reduce(
                            (acc, v) => {
                                const num = Number(v);
                                acc[num] = (acc[num] || 0) + 1;
                                return acc;
                            },
                            {} as Record<number, number>
                        );

                        const uniqueX = Object.keys(freqMap)
                            .map(Number)
                            .sort((a, b) => a - b);
                        xData = uniqueX;
                        yData = uniqueX.map((x) => freqMap[x]);
                    }
                } else {
                    const values = plot.x.map(Number);
                    const min = Math.min(...values);
                    const max = Math.max(...values);
                    const binCount = 20;
                    const step = (max - min) / binCount;

                    const bins = new Array(binCount).fill(0);

                    if (histFunc === 'sum') {
                        values.forEach((v, idx) => {
                            const binIdx = Math.min(
                                Math.floor((v - min) / step),
                                binCount - 1
                            );
                            const yVal = Number(plot.y![idx]) || 0;
                            bins[binIdx] += yVal;
                        });
                    } else {
                        values.forEach((v) => {
                            const binIdx = Math.min(
                                Math.floor((v - min) / step),
                                binCount - 1
                            );
                            bins[binIdx]++;
                        });
                    }
                    xData = Array.from(
                        { length: binCount },
                        (_, i) => min + (i + 0.5) * step
                    );
                    yData = bins;
                }
            }
            const baseSeries = {
                name: plot.name,
                type:
                    plot.type === 'line' || plot.type === 'dotted'
                        ? 'line'
                        : plot.type === 'histogram'
                          ? 'bar'
                          : 'scatter',
                data: xData.map((x, i) => [
                    x,
                    yData?.[i] ? yData?.[i] : 0,
                    plot.xInfl?.[i],
                    plot.xInfl?.[i],
                    plot.yInfl?.[i],
                    plot.yInfl?.[i],
                ]),
                itemStyle: { color: plot.color },
                lineStyle:
                    plot.type === 'dotted' ? { type: 'dotted' } : { width: 2 },
                symbolSize: plot.type === 'scatter' ? 8 : 0,
                smooth: false,
                stack: 'total',
                ...(plot.type === 'histogram' && {
                    barGap: '10%',
                    barCategoryGap: '10%',
                    barWidth: 35,
                }),
            };

            const hasError =
                plot.type === 'scatter' &&
                ((plot.yInfl && plot.yInfl.some((v: number) => v > 0)) ||
                    (plot.xInfl && plot.xInfl.some((v: number) => v > 0)));

            if (!hasError) return baseSeries;

            const errorData = xData.map((x, i) => [
                x,
                yData[i],
                x - (plot.xInfl?.[i] || 0),
                x + (plot.xInfl?.[i] || 0),
                yData[i] - (plot.yInfl?.[i] || 0),
                yData[i] + (plot.yInfl?.[i] || 0),
            ]);

            const errorSeries = {
                name: `${plot.name}-errors`,
                type: 'custom',
                renderItem: renderErrorItem(plot),
                encode: { x: 0, y: 1 },
                data: errorData,
                z: 10,
                silent: true, // не перехватывает события
            };

            return errorSeries;
        });
        const isHisto = statement.plots.every((p) => p.type === 'histogram');
        const showGrid = statement.plotGridVisible !== false;
        const showGridDirectly = statement.plotGridVisible === true;
        const splitLineConfig = showGridDirectly
            ? {
                  splitLine: {
                      show: true,
                      lineStyle: {
                          color: '#e5e7eb',
                          width: 1,
                          type: 'solid',
                      },
                  },
                  axisLine: {
                      show: true,
                      lineStyle: {
                          color: '#6b7280',
                          width: 1.5,
                      },
                  },
                  axisTick: {
                      show: true,
                      length: 6,
                      lineStyle: {
                          color: '#6b7280',
                          width: 1.5,
                      },
                  },
              }
            : showGrid
              ? { show: showGrid }
              : {};
        return {
            legend: {
                show: false,
                selected: seriesVisibility,
            },
            grid: {
                height: 300,
                top: 65,
                bottom: legendPosition === 'right' ? 65 : 120,
                left: 70,
                right: legendPosition === 'right' ? 120 : 25,
            },
            xAxis: {
                type: isHisto ? 'category' : 'value',
                nameGap: isHisto ? 20 : 40,
                ...splitLineConfig,
            },
            yAxis: {
                type: 'value',
                nameGap: 50,
                ...splitLineConfig,
            },
            series,
        };
    }, [statement, seriesVisibility, legendPosition]);


    const handleLegendClick = (plotName: string) => {
        const chart = chartRef.current?.getEchartsInstance();
        if (!chart) return;
        setSeriesVisibility((prev) => ({
            ...prev,
            [plotName]: !prev[plotName],
        }));

        chart.dispatchAction({
            type: 'legendToggleSelect',
            name: plotName,
        });
    };
    const chartHeight = useMemo(() => {
        const baseHeight = 415;
        const plotLegengItemHeight = 27;
        return (
            baseHeight +
            (legendPosition === 'right'
                ? 0
                : statement.plots.length * plotLegengItemHeight)
        );
    }, [legendPosition, statement.plots.length]);
    return (
        <div
            ref={containerRef}
            className="plot-container"
            style={{ position: 'relative', width: '100%' }}
        >
            <ReactECharts
                ref={chartRef}
                option={option}
                style={{ width: '100%', height: chartHeight }}
                opts={{ renderer: 'svg' }}
                notMerge={true}
                lazyUpdate={true}
            />
            <Plotname name={statement.plotName} />
            <Legend
                show={statement.legendVisible}
                containerRef={containerRef}
                handleLegendClick={handleLegendClick}
                ref={legendRef}
                plots={statement.plots}
                legendPosition={legendPosition}
                setLegendPosition={setLegendPosition}
                seriesVisibility={seriesVisibility}
            />
            {statement.plotXAxisName && (
                <div
                    className="plot-xaxis-label"
                    style={{
                        bottom:
                            legendPosition === 'right'
                                ? -10
                                : statement.plots.length * 27,
                    }}
                >
                    <MathJax>$${statement.plotXAxisName.replaceAll(' ', '\\:')}$$</MathJax>
                </div>
            )}
            {statement.plotYAxisName && (
                <div className="plot-yaxis-label">
                    <MathJax>$${statement.plotYAxisName.replaceAll(' ', '\\:')}$$</MathJax>
                </div>
            )}
        </div>
    );
};
