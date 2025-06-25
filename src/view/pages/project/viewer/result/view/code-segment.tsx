import classNames from 'classnames';
import { useIsSegmentIsActive } from '../../../../../../viewModel/store/selectors/program';
import { useSelector } from 'react-redux';
import { forwardRef, useMemo, useRef } from 'react';
import { AssignStatement } from './segments/assignment-segment.tsx';
import { DetailedStatement } from './segments/calculation-segment.tsx';
import { FileSegment } from './segments/file-segment.tsx';
import { TableSegment } from './segments/table-segment.tsx';
import { PlotSegment } from './segments/plot-segment.tsx';
import {
    CalcStatement,
    ComputationalOutputSegment,
    FileStatement,
    PlotStatement,
    TableStatement,
} from '../../../../../../model/domain.ts';
import { LatexSegment } from './segments/latex-segment.tsx';

/**
 * Стили дяя отображения fontsize
 * Displaystyle, Scriptstyle, scriptscriptstyle
 * Есть расширение для изменения Pt этих стилей.но надо смотреть и играться
 * \\\\ - это переход на новую строку. четыре раза, так как иддет экранирование. Так , в LaTeX  - надо \\(но у нас JS)
 * \\ - пробле
 *
 * Переводы на новую строку не работают, если ломают формулу
 */

export const CodeSegment = forwardRef<
    HTMLDivElement,
    { segment: ComputationalOutputSegment; index: number }
>(({ segment, index }, ref) => {
    const segmentRef = useRef<HTMLDivElement>(null);
    const statements = segment.statements;
    const activeIndex = useSelector(useIsSegmentIsActive(index));

    const variables = useMemo(() => {
        const vars = statements
            .map((s) => (s as CalcStatement)?.variable)
            .filter((v) => v)
            .filter((value, index, array) => array.indexOf(value) === index); // чтобы не повторялись переменные
        return vars;
    }, [statements]);

    return (
        <div
            ref={ref ?? segmentRef}
            className={classNames({
                'active-result-block-container': activeIndex,
                'result-segment': true,
            })}
        >
            {statements.map((statement, i) => {
                switch (statement.type) {
                    case 'assignment':
                        return (
                            <AssignStatement
                                key={`${i}-${JSON.stringify(statement)}`}
                                statement={statement}
                            />
                        );
                    case 'latex':
                        return (
                            <LatexSegment
                                statement={statement}
                                key={`${i}-${JSON.stringify(statement)}`}
                            />
                        );
                    case 'calculation':
                        return (
                            <DetailedStatement
                                key={`${i}-${JSON.stringify(statement)}`}
                                statement={statement as CalcStatement}
                                variables={variables}
                            />
                        );
                    case 'file': {
                        const file = statement as FileStatement;
                        return <FileSegment key={index} url={file.url} />;
                    }
                    case 'table': {
                        const table = statement as TableStatement;
                        return <TableSegment items={table.table} />;
                    }
                    case 'plot': {
                        const plot = statement as PlotStatement;
                        return (
                            <PlotSegment
                                title={plot.plotName}
                                xAxis={plot.plotXAxisName}
                                yAxis={plot.plotYAxisName}
                                plots={plot.plots}
                                legendVisible={plot.legendVisible}
                            />
                        );
                    }
                    default:
                        return <div />;
                }
            })}
        </div>
    );
});
