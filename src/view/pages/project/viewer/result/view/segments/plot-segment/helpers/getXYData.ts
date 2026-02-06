import { PlotDto } from '../../../../../../../../../model/domain';
import { groupByStep } from './calculateHistorgram';

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
        const nBins =
            plot.size &&
            Number.isInteger(Number(plot.size)) &&
            Number(plot.size) > 0
                ? Number(plot.size)
                : 10;
        const { centers, values } = groupByStep(valuesX, nBins, valuesY);
        xData = centers;
        yData = values;
    }

    return [xData, yData];
};
