import { MathJax } from 'better-react-mathjax';

export const LatexSegment = ({ statement }) => {
    return <MathJax>{statement.latex}</MathJax>;
};
