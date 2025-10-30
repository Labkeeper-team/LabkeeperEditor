import { PlotDto } from "../../../../../../../../../model/domain";
import { groupByStep } from "./calculateHistorgram";

export const getXYData = (plot: PlotDto) => {
    let xData: number[] = [];
    let yData: number[] = [];
    if (plot.type !== 'histogram') {
        xData = plot.x.map(Number);
        yData = plot.y?.map(Number);
    } else {
        const hasYData = plot.y && plot.y.length > 0;
        const valuesX = plot.x.map(Number);
        const valuesY = hasYData ? plot.y!.map(Number) : undefined;
        const dataMin = Math.min(...valuesX);
        const dataMax = Math.max(...valuesX);
        const step = plot.size
            ? Number(plot.size)
            : (dataMax - dataMin) / Math.max(1, Math.ceil(Math.sqrt(valuesX.length)));

        const { centers, values } = groupByStep(
            valuesX,
            step,
            hasYData ? 'sum' : 'count',
            valuesY
        );
        xData = centers;
        yData = values;
    }

    return [xData, yData];
}