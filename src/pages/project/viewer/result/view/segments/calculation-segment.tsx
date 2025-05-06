import { CalcStatement } from '../../../../../../shared/models/project.ts';
import { MathJax } from 'better-react-mathjax';
import {
    renderFormulaToLatex,
    renderVariableToLatex,
    renderArrayOfValuedFormulasToLatex,
    renderArrayWithoutInflToLatex,
} from '../utils.tsx';
import { renderArrayWithInflToLatex } from './../utils.tsx';

export const DetailedStatement = ({
    statement,
    variables,
}: {
    statement: CalcStatement;
    variables: string[];
}) => {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
                overflowWrap: 'break-word',
                wordWrap: 'break-word',
                whiteSpace: 'normal',
                maxWidth: '100%',
            }}
        >
            <MathJax>
                {`
        \\begin{equation}
        \\displaystyle
        ${renderVariableToLatex(statement.variable)} \\ = \\ ${renderFormulaToLatex(statement.assignment, variables)} ${statement.assignmentWithValues || statement.array ? '\\ = \\' : ''}
        \\end{equation}`}
            </MathJax>
            {!!statement.assignmentWithValues &&
                (!hasSameValuedAssignmentAndValue(statement) ||
                    !statement.array) && (
                    <MathJax>
                        {`
        \\begin{equation}
        \\displaystyle
        \\ = \\ ${renderArrayOfValuedFormulasToLatex(statement.assignmentWithValues, 0)} ${statement.array ? '\\ = \\' : ''}
        \\end{equation}`}
                    </MathJax>
                )}
            {!!statement.array && (
                <MathJax>
                    {`
        \\begin{equation} 
        \\ = \\ ${renderArrayWithInflToLatex(statement.array.array, 0)}
        \\end{equation}`}
                </MathJax>
            )}
            {!!statement.inflAssignmentGeneralFormula && (
                <MathJax>
                    {`
        \\begin{equation}
        \\displaystyle
        \\sigma(${renderVariableToLatex(statement.variable)}) \\ = \\ ${renderFormulaToLatex(statement.inflAssignmentGeneralFormula, [...variables, statement.variable], true)} ${
            !!statement.inflAssignment ||
            !!statement.inflAssignmentWithValues ||
            !!statement.array
                ? '\\ = \\'
                : ''
        }
        \\end{equation}`}
                </MathJax>
            )}
            {!!statement.inflAssignment && (
                <MathJax>
                    {`
        \\begin{equation}
        \\displaystyle
        ${!statement.inflAssignmentGeneralFormula ? `\\sigma(${renderVariableToLatex(statement.variable)}) ` : ''}= \\ ${renderFormulaToLatex(statement.inflAssignment, variables, true)} ${!!statement.inflAssignmentWithValues || !!statement.array ? '\\ =' : ''}
        \\end{equation}`}
                </MathJax>
            )}
            {!!statement.inflAssignmentWithValues && (
                <MathJax>
                    {`
        \\begin{equation}
        \\displaystyle
        ${!statement.inflAssignmentGeneralFormula && !statement.inflAssignment ? `\\sigma(${renderVariableToLatex(statement.variable)}) ` : ''}\\ = \\ ${renderArrayOfValuedFormulasToLatex(statement.inflAssignmentWithValues, 0, true)} ${statement.array ? '\\ = \\' : ''}
        \\end{equation}`}
                </MathJax>
            )}
            {!!statement.array &&
                (!!statement.inflAssignmentWithValues ||
                    !!statement.inflAssignment ||
                    !!statement.inflAssignmentGeneralFormula) && (
                    <MathJax>
                        {`
        \\begin{equation}
        \\displaystyle
        ${!statement.inflAssignmentGeneralFormula && !statement.inflAssignment && !statement.inflAssignmentWithValues ? `\\sigma(${renderVariableToLatex(statement.variable)}) ` : ''}= ${renderArrayWithoutInflToLatex(statement.array.array)}
        \\end{equation}`}
                    </MathJax>
                )}
        </div>
    );
};

function hasSameValuedAssignmentAndValue(statement: CalcStatement) {
    if (
        statement?.array?.array?.length ===
        statement?.assignmentWithValues?.length
    ) {
        for (let i = 0; i < statement.array.array.length; i++) {
            if (
                statement?.array?.array[i]?.value + '' !==
                statement?.assignmentWithValues[i]
            ) {
                return false;
            }
        }
        return true;
    }
    return true;
}
