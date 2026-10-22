import { contextUsagePercent } from '../../../viewModel/utils/contextUsage.ts';

test.each([
    [31000, 100000, 31],
    [31499, 100000, 31],
    [31500, 100000, 32],
    [0, 100000, 0],
    [100000, 100000, 100],
])('context-%p-of-%p-is-%p-percent', (used, max, percent) => {
    expect(contextUsagePercent(used, max)).toBe(percent);
});

// GH-191: если хотя бы одно поле пустое, процент не показывается
test.each([
    [null, 100000],
    [31000, null],
    [undefined, 100000],
    [31000, undefined],
    [null, null],
    [31000, 0],
])('context-%p-of-%p-gives-no-percent', (used, max) => {
    expect(contextUsagePercent(used, max)).toBeNull();
});
