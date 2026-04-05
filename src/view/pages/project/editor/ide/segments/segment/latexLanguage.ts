import {
    autocompletion,
    completeAnyWord,
    CompletionContext,
    CompletionSource,
} from '@codemirror/autocomplete';

const latexCompletions = {
    commands: [
        // Математические операторы
        { label: '\\frac' },
        { label: '\\sqrt' },
        { label: '\\sum' },
        { label: '\\int' },
        { label: '\\lim' },
        { label: '\\prod' },
        { label: '\\infty' },
        { label: '\\pm' },
        { label: '\\mp' },
        { label: '\\times' },
        { label: '\\div' },
        { label: '\\cdot' },
        { label: '\\leq' },
        { label: '\\geq' },
        { label: '\\neq' },
        { label: '\\approx' },
        { label: '\\equiv' },
        { label: '\\propto' },
        { label: '\\subset' },
        { label: '\\supset' },
        { label: '\\in' },
        { label: '\\notin' },
        { label: '\\cup' },
        { label: '\\cap' },
        { label: '\\emptyset' },
        { label: '\\exists' },
        { label: '\\forall' },
        { label: '\\rightarrow' },
        { label: '\\leftarrow' },
        { label: '\\leftrightarrow' },
        { label: '\\Rightarrow' },
        { label: '\\Leftarrow' },
        { label: '\\Leftrightarrow' },

        // Греческие буквы
        { label: '\\alpha' },
        { label: '\\beta' },
        { label: '\\gamma' },
        { label: '\\delta' },
        { label: '\\epsilon' },
        { label: '\\zeta' },
        { label: '\\eta' },
        { label: '\\theta' },
        { label: '\\iota' },
        { label: '\\kappa' },
        { label: '\\lambda' },
        { label: '\\mu' },
        { label: '\\nu' },
        { label: '\\xi' },
        { label: '\\pi' },
        { label: '\\rho' },
        { label: '\\sigma' },
        { label: '\\tau' },
        { label: '\\upsilon' },
        { label: '\\phi' },
        { label: '\\chi' },
        { label: '\\psi' },
        { label: '\\omega' },
        { label: '\\Gamma' },
        { label: '\\Delta' },
        { label: '\\Theta' },
        { label: '\\Lambda' },
        { label: '\\Xi' },
        { label: '\\Pi' },
        { label: '\\Sigma' },
        { label: '\\Phi' },
        { label: '\\Psi' },
        { label: '\\Omega' },

        // Окружения
        { label: '\\begin{' },
        { label: '\\end{' },
        { label: '\\begin{equation}' },
        { label: '\\end{equation}' },
        { label: '\\begin{align}' },
        { label: '\\end{align}' },
        { label: '\\begin{matrix}' },
        { label: '\\end{matrix}' },
        { label: '\\begin{pmatrix}' },
        { label: '\\end{pmatrix}' },
        { label: '\\begin{bmatrix}' },
        { label: '\\end{bmatrix}' },
        { label: '\\begin{cases}' },
        { label: '\\end{cases}' },
        { label: '\\begin{array}' },
        { label: '\\end{array}' },

        // Шрифты и стили
        { label: '\\mathbf' },
        { label: '\\mathit' },
        { label: '\\mathrm' },
        { label: '\\mathsf' },
        { label: '\\mathtt' },
        { label: '\\mathcal' },
        { label: '\\mathbb' },
        { label: '\\mathfrak' },

        // Скобки
        { label: '\\left(' },
        { label: '\\right)' },
        { label: '\\left[' },
        { label: '\\right]' },
        { label: '\\left\\{' },
        { label: '\\right\\}' },
        { label: '\\left|' },
        { label: '\\right|' },
        { label: '\\left\\|' },
        { label: '\\right\\|' },

        // Стрелки
        { label: '\\uparrow' },
        { label: '\\downarrow' },
        { label: '\\leftarrow' },
        { label: '\\rightarrow' },
        { label: '\\leftrightarrow' },
        { label: '\\Leftarrow' },
        { label: '\\Rightarrow' },
        { label: '\\Leftrightarrow' },
        { label: '\\mapsto' },
        { label: '\\longmapsto' },

        // Символы
        { label: '\\partial' },
        { label: '\\nabla' },
        { label: '\\hbar' },
        { label: '\\ell' },
        { label: '\\wp' },
        { label: '\\Re' },
        { label: '\\Im' },
        { label: '\\aleph' },
        { label: '\\beth' },
        { label: '\\gimel' },
        { label: '\\daleth' },

        // Акценты
        { label: '\\hat' },
        { label: '\\check' },
        { label: '\\tilde' },
        { label: '\\acute' },
        { label: '\\grave' },
        { label: '\\dot' },
        { label: '\\ddot' },
        { label: '\\breve' },
        { label: '\\bar' },
        { label: '\\vec' },
    ],
};

const latexCompletionSource: CompletionSource = (
    context: CompletionContext
) => {
    const word = context.matchBefore(/\\[\w{}]*/);
    if (!word) return null;

    return {
        from: word.from,
        options: latexCompletions.commands.map((cmd) => ({
            label: cmd.label,
            apply: (view, completion, from, to) => {
                view.dispatch({
                    changes: { from, to, insert: completion.label },
                });
            },
        })),
    };
};

/** completeAnyWord восстанавливает поведение базового autocomplete; без него override полностью его отключает. */
export const latexLanguageSupport = autocompletion({
    override: [latexCompletionSource, completeAnyWord],
});
