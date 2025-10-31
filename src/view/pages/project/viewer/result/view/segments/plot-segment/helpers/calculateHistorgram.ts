export type HistFunc = 'count' | 'sum' | 'avg';

/**
 * Plotly-like histogram binning for numeric x (and optional y) values.
 *
 * - If start/end are not provided, bins are aligned to multiples of step
 *   using floor(min/step)*step .. ceil(max/step)*step
 * - Bins are half-open [edge_i, edge_{i+1}), except the last which is closed
 * - histFunc:
 *   - count: number of x in each bin
 *   - sum: sum of y in each bin (defaults to 1 per point if y missing)
 *   - avg: average of y in each bin
 *
 * Returns centers and values per bin.
 */
export function groupByStep(
    xValues: number[],
    step: number,
    histFunc: HistFunc = 'count',
    yValues?: number[],
    start?: number,
    end?: number
): { centers: number[]; values: number[] } {
    if (!xValues.length || step <= 0) return { centers: [], values: [] };

    const dataMin = Math.min(...xValues);
    const dataMax = Math.max(...xValues);

    const alignedStart =
        start !== undefined ? start : Math.floor(dataMin / step) * step;
    const alignedEnd =
        end !== undefined ? end : Math.ceil(dataMax / step) * step;

    const binCount = Math.max(1, Math.ceil((alignedEnd - alignedStart) / step));

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

    const values = accum.map((v, i) =>
        histFunc === 'avg' ? (counts[i] > 0 ? v / counts[i] : 0) : v
    );

    const centers = Array.from(
        { length: binCount },
        (_, i) => alignedStart + (i + 0.5) * step
    );

    return { centers, values };
}
