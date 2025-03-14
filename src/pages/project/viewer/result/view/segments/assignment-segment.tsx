import { MathJax } from 'better-react-mathjax';
import {
  renderArrayWithInflToLatex, renderVariableToLatex,
} from '../utils.tsx';

export const AssignStatement = ({ statement }) => {
  const transformedVar = renderVariableToLatex(statement.variable)
  return <MathJax>{`\\begin{equation}
    \\displaystyle
    ${transformedVar}\\ = \\
    ${renderArrayWithInflToLatex(statement.array.array, transformedVar.length)}
    \\end{equation}
    `}</MathJax>;
};
