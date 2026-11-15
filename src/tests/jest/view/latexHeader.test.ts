import {
    latexHeaderDisplayFor,
    latexHeaderFor,
} from '../../../view/pages/project/editor/ide/segments/latex-boundary-card/latexHeader.ts';

describe('latexHeaderFor', () => {
    test('a project without a compiler gets the pdfLaTeX header', () => {
        const header = latexHeaderFor(undefined);

        expect(header).toBe(latexHeaderFor('pdflatex'));
        expect(header).toContain('\\usepackage[T2A]{fontenc}');
        expect(header).toContain('\\usepackage[utf8]{inputenc}');
        expect(header).toContain('cmap');
        expect(header).not.toContain('fontspec');
    });

    test('XeLaTeX header loads fontspec instead of pdfTeX-only packages', () => {
        const header = latexHeaderFor('xelatex');

        expect(header).toContain('\\usepackage{fontspec}');
        expect(header).toContain('\\setmainfont{CMU Serif}');
        expect(header).toContain('\\setsansfont{CMU Sans Serif}');
        expect(header).toContain('\\setmonofont{CMU Typewriter Text}');
        expect(header).not.toContain('fontenc');
        expect(header).not.toContain('inputenc');
        expect(header).not.toContain('cmap');
    });

    test('both headers keep the shared preamble', () => {
        for (const compiler of ['pdflatex', 'xelatex'] as const) {
            const header = latexHeaderFor(compiler);

            expect(
                header.startsWith('\\documentclass[a4paper,12pt]{article}')
            ).toBe(true);
            expect(header).toContain('\\usepackage[english,russian]{babel}');
            expect(header).toContain(
                '\\usepackage{booktabs,geometry,graphicx,listings,soul}'
            );
            expect(header.endsWith('\\begin{document}\n')).toBe(true);
        }
    });

    test('card text names fontspec only for XeLaTeX', () => {
        expect(latexHeaderDisplayFor('xelatex')).toContain('fontspec');
        expect(latexHeaderDisplayFor('pdflatex')).not.toContain('fontspec');
        expect(latexHeaderDisplayFor(undefined)).toBe(
            latexHeaderDisplayFor('pdflatex')
        );
    });
});
