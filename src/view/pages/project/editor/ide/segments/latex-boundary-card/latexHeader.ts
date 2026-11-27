import { LatexCompiler } from '../../../../../../../model/domain.ts';

const PDFLATEX_HEADER_TEXT = String.raw`\documentclass[a4paper,12pt]{article}
\usepackage{comment,cmap,amsmath,longtable,mathtools}
\usepackage{booktabs,geometry,graphicx,listings,soul}
\usepackage[T2A]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage[english,russian]{babel}
\geometry{
  a4paper,
  top=3mm,
  right=5mm,
  bottom=3mm,
  left=5mm
}
\setcounter{secnumdepth}{0}
\mathtoolsset{showonlyrefs}
\newcounter{none}
\begin{document}
`;

const PDFLATEX_ENCODING_LINES = String.raw`\usepackage[T2A]{fontenc}
\usepackage[utf8]{inputenc}
`;

// Same as the server's XeLaTeX auto-preamble: cmap, fontenc and inputenc are pdfTeX-only,
// XeLaTeX reads Unicode itself and takes OpenType fonts through fontspec. CMU covers Cyrillic.
// The math fonts have no Cyrillic, so letters from Ё to ё in formulas (v_{ср}) come from
// the italic of the main font, as mathtext does for pdfLaTeX.
const XELATEX_FONT_LINES = String.raw`\usepackage{fontspec}
\setmainfont{CMU Serif}
\setsansfont{CMU Sans Serif}
\setmonofont{CMU Typewriter Text}
\DeclareSymbolFont{cyrletters}{TU}{\rmdefault}{m}{it}
\count255="0401
\loop\Umathcode\count255="7 \symcyrletters\count255
\ifnum\count255<"0451 \advance\count255 1 \repeat
`;

const XELATEX_HEADER_TEXT = PDFLATEX_HEADER_TEXT.replace(
    '{comment,cmap,',
    '{comment,'
).replace(PDFLATEX_ENCODING_LINES, XELATEX_FONT_LINES);

const PDFLATEX_HEADER_DISPLAY_TEXT = String.raw`\documentclass[a4paper,12pt]{article}
...
\geometry{a4paper,top=3mm,right=5mm,bottom=3mm,left=5mm}
\begin{document}
`;

// the short form also names fontspec, so the card shows which engine it is for
const XELATEX_HEADER_DISPLAY_TEXT = String.raw`\documentclass[a4paper,12pt]{article}
\usepackage{fontspec}
...
\geometry{a4paper,top=3mm,right=5mm,bottom=3mm,left=5mm}
\begin{document}
`;

/** Preamble inserted by the header card; a project without a compiler builds with pdfLaTeX. */
export const latexHeaderFor = (compiler?: LatexCompiler): string =>
    compiler === 'xelatex' ? XELATEX_HEADER_TEXT : PDFLATEX_HEADER_TEXT;

/** Short preamble shown on the header card. */
export const latexHeaderDisplayFor = (compiler?: LatexCompiler): string =>
    compiler === 'xelatex'
        ? XELATEX_HEADER_DISPLAY_TEXT
        : PDFLATEX_HEADER_DISPLAY_TEXT;
