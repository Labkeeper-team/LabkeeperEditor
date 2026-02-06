export function createGridForBar(
    xValues: number[],
    yValues: number[]
): {
    newX: number[];
    newY: number[];
} {
    const sorted = xValues
        .map((val, i) => ({ x: val, y: yValues[i] }))
        .sort((a, b) => {
            if (a.x === b.x) {
                return a.y - b.y;
            }
            return a.x - b.x;
        });

    const xSorted: number[] = [];
    const ySorted: number[] = [];
    let lastIndex: number = -1;

    for (let i = 0; i < sorted.length; i++) {
        const x = sorted[i].x;
        const y = sorted[i].y;

        if (lastIndex > -1 && x === xSorted[lastIndex]) {
            if (ySorted[lastIndex] >= 0) {
                ySorted[lastIndex] = y;
            } else if (y > 0) {
                xSorted.push(x);
                ySorted.push(y);
                lastIndex = lastIndex + 1;
            }
        } else {
            xSorted.push(x);
            ySorted.push(y);
            lastIndex = lastIndex + 1;
        }
    }

    let m = Infinity;
    for (let i = 1; i < xSorted.length; i++) {
        const diff = xSorted[i] - xSorted[i - 1];
        if (diff < m && diff > 0) m = diff;
    }

    const newX: number[] = [];
    const newY: number[] = [];

    const round2 = (num: number): number => Math.round(num * 100) / 100;

    for (let i = 0; i < xSorted.length; i++) {
        const current = xSorted[i];
        const next = i < xSorted.length - 1 ? xSorted[i + 1] : null;

        newX.push(current);
        newY.push(ySorted[i]);

        if (next !== null) {
            const interval = next - current;
            const nSteps = Math.round(interval / m);
            if (nSteps > 1) {
                const step = interval / nSteps;
                for (let k = 1; k < nSteps; k++) {
                    const point = current + k * step;
                    newX.push(round2(point));
                    newY.push(0);
                }
            }
        }
    }

    return { newX, newY };
}

export function groupByStep(
    xValues: number[],
    bins: number,
    yValues?: number[]
): { centers: number[]; values: number[] } {
    if (!xValues || !Array.isArray(xValues) || xValues.length === 0) {
        return { centers: [], values: [] };
    }
    const dataMin = Math.min(...xValues);
    const dataMax = Math.max(...xValues);
    const isMinIsMax = dataMax === dataMin;
    let alignedStart: number = dataMin;
    let alignedEnd: number = dataMax;
    let step: number = 1;
    let binCount: number = bins;
    if (yValues) {
        if (xValues.length == yValues.length) {
            const { newX, newY } = createGridForBar(xValues, yValues);
            return { centers: newX, values: newY };
        } else return { centers: [], values: [] };
    } else {
        if (isMinIsMax) {
            alignedStart = dataMin - 0.5;
            alignedEnd = dataMax + 0.5;
            binCount = 1;
        } else {
            step = (dataMax - dataMin) / bins;
        }
    }
    const accum: number[] = new Array(binCount).fill(0);
    const counts: number[] = new Array(binCount).fill(0);

    for (let i = 0; i < xValues.length; i++) {
        const x = xValues[i];
        if (x < alignedStart || x > alignedEnd) continue;
        let idx = Math.floor((x - alignedStart) / step);
        if (idx >= binCount) idx = binCount - 1;
        accum[idx] += 1;
        counts[idx] += 1;
    }

    const values = accum;

    const centerOffset = isMinIsMax ? 0 : 0.5;
    const centers = Array.from(
        { length: binCount },
        (_, i) => +(alignedStart + (i + centerOffset) * step).toFixed(2)
    );
    return { centers, values };
}
