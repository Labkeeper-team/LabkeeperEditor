import { PlotDto } from '../../../../../../../../../model/domain';

export const getBaseSeries = (
    plot: PlotDto,
    xData: number[],
    yData: number[]
) => {
    return {
        name: plot.name,
        type:
            plot.type === 'line' || plot.type === 'dotted'
                ? 'line'
                : plot.type === 'histogram'
                  ? 'bar'
                  : 'scatter',
        data: xData.map((x, i) => [
            +x,
            yData?.[i] ? +yData?.[i] : 0,
            plot.xInfl?.[i] ? +plot.xInfl?.[i] : 0,
            plot.xInfl?.[i] ? +plot.xInfl?.[i] : 0,
            plot.yInfl?.[i] ? +plot.yInfl?.[i] : 0,
            plot.yInfl?.[i] ? +plot.yInfl?.[i] : 0,
        ]),
        itemStyle: { color: plot.color },
        lineStyle: plot.type === 'dotted' ? { type: 'dotted' } : { width: 2 },
        symbolSize: plot.type === 'scatter' ? 8 : 0,
        encode: { x: 0, y: 1 },
        smooth: false,
        ...(plot.type === 'histogram' && {
            stack: 'total',
            barGap: '0%',
            barCategoryGap: '0%',
            barWidth: '100%',
        }),
        z: 1,

        // 👇 добавляем осевые индексы
        xAxisIndex: 1,
        yAxisIndex: 1,
    };
};
