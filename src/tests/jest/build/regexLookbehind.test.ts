import {
    guardedRegExp,
    stripLookbehind,
} from '../../../../scripts/vite/regexLookbehind.ts';

// шаблон автоссылок на почту из mdast-util-gfm-autolink-literal 2.0.1
const EMAIL = String.raw`(?<=^|\s|\p{P}|\p{S})([-.\w+]+)@([-\w]+(?:\.[-\w]+)+)`;

test('without lookbehind the email pattern is the one of version 2.0.0', () => {
    expect(stripLookbehind(EMAIL)).toBe(
        String.raw`([-.\w+]+)@([-\w]+(?:\.[-\w]+)+)`
    );
});

test('brackets inside a character class and escapes do not end the group', () => {
    expect(stripLookbehind(String.raw`(?<![(\)])a(?<=\(b)c`)).toBe('ac');
});

test('negative lookbehind is stripped as well', () => {
    expect(stripLookbehind('(?<!x)y')).toBe('y');
});

test('(?<= inside a character class is not a group', () => {
    expect(stripLookbehind('[(?<=]x(?<=y)z')).toBe('[(?<=]xz');
});

test('a pattern without lookbehind stays as it is', () => {
    expect(stripLookbehind(String.raw`(?:a|\()b[(]`)).toBe(
        String.raw`(?:a|\()b[(]`
    );
});

// где lookbehind есть, выражение то же самое, что было литералом
test('the guarded expression matches like the literal', () => {
    const guarded = new Function(
        `return ${guardedRegExp(EMAIL, 'gu')}`
    )() as RegExp;

    expect(guarded.source).toBe(new RegExp(EMAIL, 'gu').source);
    expect(guarded.flags).toBe('gu');
    expect('пишите, a.b@mail.ru'.match(guarded)).toEqual(['a.b@mail.ru']);
});

// старый Safari бросает на lookbehind SyntaxError: тогда берётся шаблон без него
test('the guarded expression falls back when RegExp rejects lookbehind', () => {
    const NativeRegExp = RegExp;
    const OldSafariRegExp = function (pattern: string, flags?: string) {
        if (/\(\?<[=!]/.test(pattern)) {
            throw new SyntaxError(
                'Invalid regular expression: invalid group specifier name'
            );
        }
        return new NativeRegExp(pattern, flags);
    };

    const guarded = new Function(
        'RegExp',
        `return ${guardedRegExp(EMAIL, 'gu')}`
    )(OldSafariRegExp) as RegExp;

    expect(guarded.source).toBe(
        new NativeRegExp(stripLookbehind(EMAIL), 'gu').source
    );
});
