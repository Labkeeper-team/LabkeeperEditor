export type HistFunc = 'count' | 'sum';

export function groupByStep(
    xValues: number[],
    step_: number,
    histFunc: HistFunc = 'count',
    yValues?: number[],
    start?: number,
    end?: number
): { centers: number[]; values: number[] } {
    if (!xValues.length) return { centers: [], values: [] };
    const step = step_ ? step_ : 1;
    const dataMin = Math.min(...xValues);
    const dataMax = Math.max(...xValues);
    const isStepWasSet = step_ !== 0;
    const alignedStart =
        start !== undefined ? start : Math.floor(dataMin / step) * step;
    const alignedEnd =
        end !== undefined ? end : Math.ceil(dataMax / step) * step;

    const binCount = Math.floor((alignedEnd - alignedStart) / step) + 1;

    const accum: number[] = new Array(binCount).fill(0);
    const counts: number[] = new Array(binCount).fill(0);

    for (let i = 0; i < xValues.length; i++) {
        const x = xValues[i];
        const y = yValues?.[i] ?? 1;
        if (x < alignedStart || x > alignedEnd) continue;

        let idx = Math.floor((x - alignedStart) / step);
        if (idx >= binCount) idx = binCount - 1;

        if (histFunc === 'count') {
            accum[idx] += 1;
        } else if (histFunc === 'sum' || histFunc === 'avg') {
            accum[idx] += y;
        }
        counts[idx] += 1;
    }

    const values = accum;

    const centerOffset = isStepWasSet ? 0 : 0.5;

    const centers = Array.from(
        { length: binCount },
        (_, i) => alignedStart + (i + centerOffset) * step
    );

    return { centers, values };
}
