import { MathJax } from 'better-react-mathjax';
import { parser } from '../utils.tsx';

interface TableSegmentProps {
    items: string[][];
}

export const TableSegment = ({ items }: TableSegmentProps) => {
    if (!items || items.length === 0) {
        return null;
    }

    return (
        <div className="markdown-body">
            <table>
                <tbody>
                    {items.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                            {row.map((cell, cellIndex) => (
                                <td key={`${rowIndex}-${cellIndex}`}>
                                    {containsLatex(cell) ? (
                                        <MathJax>{`
                                        \\begin{equation}
                                        ${parser.parse(cell)}
                                        \\end{equation}
                                        `}</MathJax>
                                    ) : (
                                        cell
                                    )}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

function containsLatex(string: string): boolean {
    return (
        string.includes('\\') || string.includes('^') || string.includes('_')
    );
}
