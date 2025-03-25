import classNames from 'classnames';
import { useIsSegmentIsActive } from '../../../../../store/selectors/program';
import { useSelector } from 'react-redux';
import { forwardRef, useMemo, useRef } from 'react';
import { AssignStatement } from './segments/assignment-segment.tsx';
import { DetailedStatement } from './segments/calculation-segment.tsx';
import { FileSegment } from './segments/file-segment.tsx';
import {TableSegment} from "./segments/table-segment.tsx";
import {PlotSegment} from "./segments/plot-segment.tsx";

/**
 * Стили дяя отображения fontsize
 * Displaystyle, Scriptstyle, scriptscriptstyle
 * Есть расширение для изменения Pt этих стилей.но надо смотреть и играться
 * \\\\ - это переход на новую строку. четыре раза, так как иддет экранирование. Так , в LaTeX  - надо \\(но у нас JS)
 * \\ - пробле
 * 
 * Переводы на новую строку не работают, если ломают формулу
 */


export const CodeSegment = forwardRef<HTMLDivElement, any>(
  ({ segment, index }, ref) => {
    const segmentRef = useRef<HTMLDivElement>(null);
    const statements = segment.statements;
    const activeIndex = useSelector(useIsSegmentIsActive(segment.id));

    const variables = useMemo(() => {
      const vars = statements
        .map((s) => s.variable)
        .filter(v => v)
        .filter((value, index, array) => array.indexOf(value) === index); // чтобы не повторялись переменные
      return vars;
    }, [statements]);

    return (
      <div
        ref={ref ?? segmentRef}
        className={classNames({ 'active-result-block-container': activeIndex,  'result-segment': true })}
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
            case 'calculation':
              return (
                <DetailedStatement
                  key={`${i}-${JSON.stringify(statement)}`}
                  statement={statement}
                  variables={variables}
                />
              );
            case 'file':
              return (<FileSegment key={index} url={statement.url}/>)
              case 'table':
              return <TableSegment items={statement.table}/>
            case 'plot':
              return <PlotSegment title={statement.plotName}
                                  xAxis={statement.plotXAxisName}
                                  yAxis={statement.plotYAxisName}
                                  curves={statement.plots}/>
            default:
              return <div />;
          }
        })}
      </div>
    );
  }
);