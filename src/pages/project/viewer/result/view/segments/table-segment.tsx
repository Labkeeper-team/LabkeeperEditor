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
                                <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
