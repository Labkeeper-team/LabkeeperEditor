import { useRef, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import './plot-segment.scss';
import { PlotStatement } from '../../../../../../../../model/domain.ts';
import { Legend, LegendPosition } from './legend.tsx';
import { renderErrorItem } from './helpers/renderErrorItem.ts';
import { Plotname } from './plotname.tsx';

import { MathJax } from 'better-react-mathjax';
import { getBaseSeries } from './helpers/getSeries.ts';
import { getGrid } from './helpers/getGrid.ts';
import { getXYData } from './helpers/getXYData.ts';

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
        const histogramPlots = statement.plots.filter(
            (p) => p.type === 'histogram'
        );
        const histogramMin =
            histogramPlots.length > 0
                ? Math.min(...histogramPlots.flatMap((p) => p.x.map(Number)))
                : undefined;
        const series = statement.plots.map((plot) => {
            const [xData, yData] = getXYData(plot);
            const baseSeries = getBaseSeries(plot, xData, yData);

            const hasError =
                plot.type === 'scatter' &&
                ((plot.yInfl && plot.yInfl.some((v: number) => v > 0)) ||
                    (plot.xInfl && plot.xInfl.some((v: number) => v > 0)));

            if (!hasError) {
                return baseSeries;
            }

            const errorData = xData.map((x, i) => [
                +x,
                +yData[i],
                +x - +(plot.xInfl?.[i] || 0),
                +x + +(plot.xInfl?.[i] || 0),
                +yData[i] - +(plot.yInfl?.[i] || 0),
                +yData[i] + +(plot.yInfl?.[i] || 0),
            ]);

            const errorSeries = {
                name: `${plot.name}-errors`,
                type: 'custom',
                renderItem: renderErrorItem(plot),
                encode: { x: 0, y: 1 },
                data: errorData,
                z: 2,
                silent: true, // не перехватывает события
            };

            return errorSeries;
        });
        const isHisto = statement.plots.every((p) => p.type === 'histogram');
        const showGrid = statement.plotGridVisible !== false;
        const showGridDirectly = statement.plotGridVisible === true;
        const isPlotContainsHisto = !isHisto && !!histogramMin;
        const splitLineConfig = showGridDirectly
            ? getGrid()
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
                right: statement.legendVisible
                    ? legendPosition === 'right'
                        ? 120
                        : 25
                    : 25,
            },
            xAxis: {
                type: isHisto ? 'category' : 'value',
                nameGap: isHisto ? 20 : 40,
                splitNumber: 8, // Увеличиваем количество делений для более детальной сетки
                minInterval: isHisto ? undefined : 0.25, // Минимальный интервал между делениями
                boundaryGap: isHisto ? ['0%', '0%'] : ['10%', '10%'],
                // Если есть гистограмма и ось числовая, используем минимальное значение гистограммы
                min: isPlotContainsHisto
                    ? histogramMin - 0.003 * histogramMin
                    : undefined,
                ...splitLineConfig,
                z: 0
            },
            yAxis: {
                type: 'value',
                nameGap: 50,
                splitNumber: 8, // Увеличиваем количество делений для более детальной сетки
                minInterval: isHisto ? undefined : 0.25, // Минимальный интервал между делениями
                boundaryGap: isHisto ? ['0%', '0%'] : ['10%', '10%'], // Добавляем отступы по краям
                ...splitLineConfig,
                z: 0
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
        return (
            baseHeight +
            (legendPosition === 'right'
                ? 0
                : (legendRef.current?.clientHeight ?? 0))
        );
    }, [legendPosition, legendRef]);
    console.log(statement.plots)
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
                                : (legendRef?.current?.clientHeight ?? 0) - 6,
                    }}
                >
                    <MathJax>
                        $${statement.plotXAxisName.replaceAll(' ', '\\:')}$$
                    </MathJax>
                </div>
            )}
            <div
                style={{ position: 'absolute', height: 415, width: 40, top: 0 }}
            >
                <div
                    style={{
                        position: 'relative',
                        width: '100%',
                        height: '100%',
                    }}
                >
                    {statement.plotYAxisName && (
                        <div className="plot-yaxis-label">
                            <MathJax>
                                $$
                                {statement.plotYAxisName.replaceAll(' ', '\\:')}
                                $$
                            </MathJax>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
