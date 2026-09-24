import {
    mostVisiblePageIndex,
    namedActionPageIndex,
    nearestRectIndex,
    PdfDestinationSource,
    resolvePdfDestination,
} from '../../../view/utils/pdfLinks.ts';

// ссылки на страницы как их отдаёт pdf.js: объект {num, gen}, у второй страницы свой номер объекта
const PAGE_1 = { num: 12, gen: 0 };
const PAGE_2 = { num: 34, gen: 0 };
const PAGE_INDEX = new Map([
    [PAGE_1.num, 0],
    [PAGE_2.num, 1],
]);

// именованные назначения из настоящего PDF pdfTeX с hyperref
const NAMED: Record<string, unknown[]> = {
    secondtarget: [PAGE_2, { name: 'XYZ' }, 14.173, 833.386, null],
    'page.1': [PAGE_1, { name: 'XYZ' }, 13.173, 871.248, null],
};

const source: PdfDestinationSource = {
    numPages: 3,
    getDestination: async (id) => NAMED[id] ?? null,
    getPageIndex: async (ref) => {
        const index = PAGE_INDEX.get(ref.num);
        if (index === undefined) {
            throw new Error('not a page');
        }
        return index;
    },
};

describe('resolvePdfDestination', () => {
    test('named destination of hyperref resolves to its page and point', async () => {
        expect(await resolvePdfDestination('secondtarget', source)).toEqual({
            pageIndex: 1,
            left: 14.173,
            top: 833.386,
        });
    });

    test('unknown named destination is ignored', async () => {
        expect(await resolvePdfDestination('missing', source)).toBeNull();
    });

    test.each([
        [
            'XYZ with coordinates',
            [PAGE_1, { name: 'XYZ' }, 0, 400, null],
            { pageIndex: 0, left: 0, top: 400 },
        ],
        [
            'XYZ with null coordinates keeps the page top',
            [PAGE_1, { name: 'XYZ' }, null, null, 2],
            { pageIndex: 0, left: null, top: null },
        ],
        [
            'Fit goes to the page top',
            [PAGE_2, { name: 'Fit' }],
            { pageIndex: 1, left: null, top: null },
        ],
        [
            'FitB goes to the page top',
            [PAGE_2, { name: 'FitB' }],
            { pageIndex: 1, left: null, top: null },
        ],
        [
            'FitH takes the top',
            [PAGE_2, { name: 'FitH' }, 500],
            { pageIndex: 1, left: null, top: 500 },
        ],
        [
            'FitBH with null top goes to the page top',
            [PAGE_2, { name: 'FitBH' }, null],
            { pageIndex: 1, left: null, top: null },
        ],
        [
            'FitV takes the left edge only',
            [PAGE_2, { name: 'FitV' }, 120],
            { pageIndex: 1, left: 120, top: null },
        ],
        [
            'FitR takes the upper edge of the rectangle',
            [PAGE_1, { name: 'FitR' }, 10, 300, 200, 450],
            { pageIndex: 0, left: 10, top: 450 },
        ],
        [
            'FitR with swapped corners still takes the upper edge',
            [PAGE_1, { name: 'FitR' }, 200, 450, 10, 300],
            { pageIndex: 0, left: 10, top: 450 },
        ],
        [
            'page given as a zero-based number',
            [2, { name: 'XYZ' }, 0, 100, null],
            { pageIndex: 2, left: 0, top: 100 },
        ],
    ])('%s', async (_name, dest, expected) => {
        expect(await resolvePdfDestination(dest, source)).toEqual(expected);
    });

    test.each([
        ['empty array', []],
        ['unknown fit type', [PAGE_1, { name: 'Zoom' }, 0, 0]],
        [
            'page reference outside the page tree',
            [{ num: 99, gen: 0 }, { name: 'Fit' }],
        ],
        ['page number past the last page', [3, { name: 'Fit' }]],
        ['negative page number', [-1, { name: 'Fit' }]],
        ['fractional page number', [0.5, { name: 'Fit' }]],
        ['no fit type', [PAGE_1]],
    ])('broken destination is ignored: %s', async (_name, dest) => {
        expect(await resolvePdfDestination(dest, source)).toBeNull();
    });

    test('missing destination is ignored', async () => {
        expect(await resolvePdfDestination(null, source)).toBeNull();
        expect(await resolvePdfDestination('', source)).toBeNull();
    });
});

describe('namedActionPageIndex', () => {
    test.each([
        ['NextPage', 0, 1],
        ['NextPage', 2, null],
        ['PrevPage', 1, 0],
        ['PrevPage', 0, null],
        ['FirstPage', 2, 0],
        ['LastPage', 0, 2],
        ['GoBack', 1, null],
        ['Print', 1, null],
    ])('%s from page %i', (action, current, expected) => {
        expect(namedActionPageIndex(action, current, 3)).toBe(expected);
    });
});

describe('mostVisiblePageIndex', () => {
    // три страницы по 1000 px с зазором 4 px, как в просмотрщике
    const pages = [
        { top: 0, height: 1000 },
        { top: 1004, height: 1000 },
        { top: 2008, height: 1000 },
    ];

    test.each([
        ['top of the document', 0, 0],
        ['first page still shows more', 300, 0],
        ['second page shows more', 700, 1],
        ['last page at the bottom', 2300, 2],
        ['equal halves keep the upper page', 602, 0],
    ])('%s', (_name, scrollTop, expected) => {
        expect(mostVisiblePageIndex(pages, scrollTop, 800)).toBe(expected);
    });

    test('no pages gives the first page', () => {
        expect(mostVisiblePageIndex([], 0, 800)).toBe(0);
    });
});

describe('nearestRectIndex', () => {
    // две ссылки на соседних строках телефона: строки через 9 px, рамки по 8 px
    const upper = { left: 60, top: 100, right: 120, bottom: 108 };
    const lower = { left: 60, top: 109, right: 120, bottom: 117 };
    // цифра \pageref в несколько пикселей
    const tiny = { left: 200, top: 100, right: 205, bottom: 108 };
    const rects = [upper, lower, tiny];

    test.each([
        ['inside a link', 80, 104, 0],
        ['inside the lower link', 80, 113, 1],
        ['just right of the tiny link', 211, 104, 2],
        ['below the lower link picks it, not the upper one', 80, 122, 1],
        ['between the links picks the closer upper one', 130, 105, 0],
        ['too far from every link', 160, 104, null],
        ['far below', 80, 140, null],
    ])('%s', (_name, x, y, expected) => {
        expect(nearestRectIndex(rects, x, y, 12)).toBe(expected);
    });

    test('overlapping links give the later one, it lies on top', () => {
        const under = { left: 0, top: 0, right: 50, bottom: 10 };
        const over = { left: 40, top: 0, right: 90, bottom: 10 };
        expect(nearestRectIndex([under, over], 45, 5, 12)).toBe(1);
    });

    test('no links', () => {
        expect(nearestRectIndex([], 0, 0, 12)).toBeNull();
    });
});
