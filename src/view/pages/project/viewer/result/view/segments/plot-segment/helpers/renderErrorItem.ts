import { PlotDto } from '../../../../../../../../../model/domain';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const renderErrorItem = (plot: PlotDto) => (params: any, api: any) => {
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
};
