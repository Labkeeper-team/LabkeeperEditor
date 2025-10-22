import { useEffect, useRef, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import './plot-segment.scss';
import { PlotStatement } from '../../../../../../../model/domain.ts';

export const PlotSegment = ({ statement }: { statement: PlotStatement }) => {
    const chartRef = useRef<ReactECharts | null>(null);
    const legendRef = useRef<HTMLDivElement>(null);

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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                renderItem: (params: any, api: any) => {
                    const xValue = api.value(0);
                    const yValue = api.value(1);
                    const xLow = api.value(2);
                    const xHigh = api.value(3);
                    const yLow = api.value(4);
                    const yHigh = api.value(5);

                    const center = api.coord([xValue, yValue]);
                    const xLowCoord = api.coord([xLow, yValue])[0];
                    const xHighCoord = api.coord([xHigh, yValue])[0];
                    const yLowCoord = api.coord([xValue, yLow])[1];
                    const yHighCoord = api.coord([xValue, yHigh])[1];

                    const style = api.style({
                        stroke: plot.color,
                        fill: null,
                        width: 2,
                    });

                    // Рисуем крест — вертикальные и горизонтальные error bars
                    return {
                        type: 'group',
                        children: [
                            {
                                type: 'line',
                                shape: {
                                    x1: xLowCoord,
                                    y1: center[1],
                                    x2: xHighCoord,
                                    y2: center[1],
                                },
                                style,
                            },
                            {
                                type: 'line',
                                shape: {
                                    x1: center[0],
                                    y1: yLowCoord,
                                    x2: center[0],
                                    y2: yHighCoord,
                                },
                                style,
                            },
                            {
                                type: 'line',
                                shape: {
                                    x1: xLowCoord,
                                    y1: center[1] - 3,
                                    x2: xLowCoord,
                                    y2: center[1] + 3,
                                },
                                style,
                            },
                            {
                                type: 'line',
                                shape: {
                                    x1: xHighCoord,
                                    y1: center[1] - 3,
                                    x2: xHighCoord,
                                    y2: center[1] + 3,
                                },
                                style,
                            },
                            {
                                type: 'line',
                                shape: {
                                    x1: center[0] - 3,
                                    y1: yLowCoord,
                                    x2: center[0] + 3,
                                    y2: yLowCoord,
                                },
                                style,
                            },
                            {
                                type: 'line',
                                shape: {
                                    x1: center[0] - 3,
                                    y1: yHighCoord,
                                    x2: center[0] + 3,
                                    y2: yHighCoord,
                                },
                                style,
                            },
                        ],
                    };
                },
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
            grid: { top: 65, bottom: 65, left: 70, right: 120 },
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
    }, [statement, seriesVisibility]);

    useEffect(() => {
        const chart = chartRef.current?.getEchartsInstance();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const renderMath = () => (window.MathJax as any)?.typesetPromise?.();
        chart?.on('finished', renderMath);
        return () => {
            chart?.off('finished', renderMath);
        };
    }, []);

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

    return (
        <div
            className="plot-container"
            style={{ position: 'relative', width: '100%', height: 400 }}
        >
            <ReactECharts
                ref={chartRef}
                option={option}
                style={{ width: '100%', height: '100%' }}
                opts={{ renderer: 'svg' }}
            />

            {statement.plotName && (
                <div
                    className="plot-title"
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        fontSize: '14px',
                        textAlign: 'center',
                        pointerEvents: 'none',
                    }}
                >
                    $${statement.plotName}$$
                </div>
            )}

            {statement.legendVisible && (
                <div
                    ref={legendRef}
                    className="custom-legend"
                    style={{
                        position: 'absolute',
                        right: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        fontSize: '12px',
                        pointerEvents: 'auto',
                    }}
                >
                    {statement.plots.map((plot, idx) => {
                        const isVisible = seriesVisibility[plot.name];
                        return (
                            <div
                                key={idx}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
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
                                        height:
                                            plot.type === 'histogram' ? 12 : 2,
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
                                    }}
                                >
                                    $${plot.name}$$
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
            {statement.plotXAxisName && (
                <div
                    className="plot-xaxis-label"
                    style={{
                        position: 'absolute',
                        bottom: -10,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        fontSize: '12px',
                        textAlign: 'center',
                        pointerEvents: 'none',
                    }}
                >
                    $${statement.plotXAxisName}$$
                </div>
            )}

            {statement.plotYAxisName && (
                <div
                    className="plot-yaxis-label"
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: -10,
                        transform: 'translateY(-50%) rotate(-90deg)',
                        transformOrigin: 'left top',
                        fontSize: '12px',
                        textAlign: 'center',
                        pointerEvents: 'none',
                    }}
                >
                    $${statement.plotYAxisName}$$
                </div>
            )}
        </div>
    );
};
