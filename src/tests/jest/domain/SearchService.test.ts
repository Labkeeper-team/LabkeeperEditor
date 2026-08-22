import { Program } from '../../../model/domain.ts';
import { SearchService } from '../../../viewModel/domain/SearchService.ts';

function programOf(texts: string[]): Program {
    return {
        segments: texts.map((text) => ({
            type: 'md',
            parameters: { visible: true },
            text,
        })),
        parameters: { roundStrategy: 'noRound' },
    };
}

test('find-matches-is-case-sensitive-and-ordered-by-document', () => {
    const service = new SearchService();

    const matches = service.findMatches(
        programOf(['ab Ab ab', 'x', 'ab']),
        'ab'
    );

    expect(matches).toEqual([
        { segmentIndex: 0, from: 0, to: 2, line: 1 },
        { segmentIndex: 0, from: 6, to: 8, line: 1 },
        { segmentIndex: 2, from: 0, to: 2, line: 1 },
    ]);
});

test('find-matches-returns-empty-for-empty-query', () => {
    const service = new SearchService();

    expect(service.findMatches(programOf(['aaa']), '')).toEqual([]);
});

test('find-matches-reports-1-based-line-in-multiline-segment', () => {
    const service = new SearchService();

    const matches = service.findMatches(
        programOf(['first\nsecond foo\n\nfourth foo']),
        'foo'
    );

    expect(matches).toEqual([
        { segmentIndex: 0, from: 13, to: 16, line: 2 },
        { segmentIndex: 0, from: 25, to: 28, line: 4 },
    ]);
});

test('find-matches-does-not-overlap', () => {
    const service = new SearchService();

    expect(service.findMatches(programOf(['aaa']), 'aa')).toEqual([
        { segmentIndex: 0, from: 0, to: 2, line: 1 },
    ]);
});

test('find-matches-supports-special-characters-literally', () => {
    const service = new SearchService();

    const matches = service.findMatches(
        programOf(['\\frac{a}{b} and $x$']),
        '\\frac'
    );

    expect(matches).toEqual([{ segmentIndex: 0, from: 0, to: 5, line: 1 }]);
});

test('first-index-at-or-after-picks-match-below-anchor-line', () => {
    const service = new SearchService();
    const matches = service.findMatches(
        programOf(['foo\nbar\nfoo', 'foo']),
        'foo'
    );

    expect(
        service.firstIndexAtOrAfter(matches, { segmentIndex: 0, line: 2 })
    ).toBe(1);
});

test('first-index-at-or-after-skips-to-next-segment-when-none-below', () => {
    const service = new SearchService();
    const matches = service.findMatches(programOf(['foo\nbar', 'foo']), 'foo');

    expect(
        service.firstIndexAtOrAfter(matches, { segmentIndex: 0, line: 2 })
    ).toBe(1);
});

test('first-index-at-or-after-wraps-to-first-when-anchor-is-past-all', () => {
    const service = new SearchService();
    const matches = service.findMatches(programOf(['foo', 'bar']), 'foo');

    expect(
        service.firstIndexAtOrAfter(matches, { segmentIndex: 5, line: 1 })
    ).toBe(0);
});

test('first-index-at-or-after-returns-first-for-null-anchor', () => {
    const service = new SearchService();
    const matches = service.findMatches(programOf(['foo', 'foo']), 'foo');

    expect(service.firstIndexAtOrAfter(matches, null)).toBe(0);
});

test('first-index-at-or-after-returns-minus-one-for-empty-matches', () => {
    const service = new SearchService();

    expect(service.firstIndexAtOrAfter([], { segmentIndex: 0, line: 1 })).toBe(
        -1
    );
});

test('next-index-after-moves-forward-and-wraps', () => {
    const service = new SearchService();
    const matches = service.findMatches(
        programOf(['foo', 'foo', 'foo']),
        'foo'
    );

    expect(
        service.nextIndexAfter(matches, { segmentIndex: 0, from: 0, to: 3 })
    ).toBe(1);
    expect(
        service.nextIndexAfter(matches, { segmentIndex: 2, from: 0, to: 3 })
    ).toBe(0);
});

test('next-index-after-falls-back-to-closest-when-current-is-gone', () => {
    const service = new SearchService();
    const matches = service.findMatches(programOf(['foo', 'foo']), 'foo');

    // такого совпадения в списке нет: текст поменялся между Enter
    expect(
        service.nextIndexAfter(matches, { segmentIndex: 0, from: 40, to: 43 })
    ).toBe(1);
});

test('next-index-after-returns-first-for-null-current', () => {
    const service = new SearchService();
    const matches = service.findMatches(programOf(['foo', 'foo']), 'foo');

    expect(service.nextIndexAfter(matches, null)).toBe(0);
});

test('next-index-after-returns-minus-one-for-empty-matches', () => {
    const service = new SearchService();

    expect(service.nextIndexAfter([], null)).toBe(-1);
});

test('line-of-offset-is-1-based', () => {
    const service = new SearchService();

    expect(service.lineOfOffset('a\nb\nc', 0)).toBe(1);
    expect(service.lineOfOffset('a\nb\nc', 4)).toBe(3);
});
