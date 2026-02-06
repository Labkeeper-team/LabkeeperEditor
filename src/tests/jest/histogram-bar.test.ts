import { createGridForBar } from '../../view/pages/project/viewer/result/view/segments/plot-segment/helpers/calculateHistorgram.ts';

test('check-bar-with-lots-duplicate-x-grid-with-one-y', () => {
    const { newX, newY } = createGridForBar(
        [1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 5, 5],
        [1, 3, 2, -1, -3, -2, 0, 0, 0, 1, 2, -5, -7]
    );
    console.log(newX, newY);

    expect(newX).toEqual([1, 2, 3, 4, 5]);
    expect(newY).toEqual([3, -3, 0, 2, -7]);
});

test('check-bar-with-lots-duplicate-x-grid-with-two-y-without-zero', () => {
    const { newX, newY } = createGridForBar([1, 1, 1, 1, 1], [-1, 3, -2, 4, 5]);
    console.log(newX, newY);

    expect(newX).toEqual([1, 1]);
    expect(newY).toEqual([-2, 5]);
});

test('check-bar-with-lots-duplicate-x-grid-with-two-y-with-zero', () => {
    const { newX, newY } = createGridForBar(
        [1, 1, 1, 1, 1, 1, 1],
        [-1, 3, -2, 4, 5, 0, 0]
    );
    console.log(newX, newY);

    expect(newX).toEqual([1, 1]);
    expect(newY).toEqual([-2, 5]);
});

test('check-bar-with-lots-duplicate-x-grid-without-negative-numbers', () => {
    const { newX, newY } = createGridForBar([1, 1, 1, 1, 1], [3, 4, 5, 0, 0]);
    console.log(newX, newY);

    expect(newX).toEqual([1]);
    expect(newY).toEqual([5]);
});

test('check-bar-with-lots-duplicate-x-grid-with-two-y-without-positive-numbers', () => {
    const { newX, newY } = createGridForBar(
        [1, 1, 1, 1, 1],
        [-3, -4, -5, 0, 0]
    );
    console.log(newX, newY);

    expect(newX).toEqual([1]);
    expect(newY).toEqual([-5]);
});
