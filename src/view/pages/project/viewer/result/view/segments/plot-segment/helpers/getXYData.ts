import { PlotDto } from '../../../../../../../../../model/domain';
import { groupByStep } from './calculateHistorgram';

export const getXYData = (plot: PlotDto) => {
    if (plot.type !== 'histogram') {
        return [plot.x.map(Number), plot.y?.map(Number)] as const;
    }

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
    return [centers, values] as const;
};
