import Plot from 'react-plotly.js';
import './plot-segment.scss';
import { PlotStatement } from '../../../../../../../model/domain.ts';

export const PlotSegment = ({ statement }: { statement: PlotStatement }) => {
    const traces = statement.plots.map((plot) => ({
        x: plot.x,
        y:
            plot.type !== 'histogram'
                ? plot.y
                : plot.y?.length > 0
                  ? plot.y
                  : undefined,
        type: plot.type === 'histogram' ? 'histogram' : 'scatter',
        histfunc:
            plot.type === 'histogram' && plot.y?.length > 0 ? 'sum' : undefined,
        xbins:
            plot.type === 'histogram' && plot.size
                ? { size: plot.size }
                : undefined,
        name: plot.name,
        text: plot.type === 'scatter' ? plot.name : undefined,
        mode:
            plot.type === 'scatter'
                ? 'markers'
                : plot.type === 'line' || plot.type === 'dotted'
                  ? 'lines'
                  : undefined,
        line: {
            color: plot.color,
            ...(plot.type === 'dotted' ? { dash: 'dot' } : {}),
        },
        error_y: {
            type: 'data',
            array: plot.yInfl,
            visible: plot.yInfl.length > 0 && plot.type === 'scatter',
        },
        error_x: {
            type: 'data',
            array: plot.xInfl,
            visible: plot.xInfl.length > 0 && plot.type === 'scatter',
        },
    }));

    const axisEnhancement =
        statement.plotGridVisible === true
            ? {
                  showgrid: true,
                  ticks: 'outside',
                  ticklen: 6,
                  tickwidth: 1.5,
                  tickcolor: '#6b7280',
                  showline: true,
                  linewidth: 1.5,
                  linecolor: '#6b7280',
                  minor: {
                      ticks: 'outside',
                      ticklen: 3,
                      tickwidth: 1,
                      tickcolor: '#9ca3af',
                      showgrid: true,
                      gridwidth: 0.5,
                      gridcolor: '#e5e7eb',
                  },
              }
            : typeof statement.plotGridVisible === 'boolean'
              ? { showgrid: false }
              : {};

    const layout = {
        title: {
            text: statement.plotName,
        },
        showlegend: statement.legendVisible,
        xaxis: {
            title: {
                text: statement.plotXAxisName,
            },
            ...axisEnhancement,
        },
        yaxis: {
            title: {
                text: statement.plotYAxisName,
            },
            ...axisEnhancement,
        },
        margin: {
            t: 40,
            b: 60,
            l: 80,
            r: 20,
        },
    };

    return (
        <div
            className="plot-container"
            style={{ height: '100%', width: '100%' }}
        >
            <Plot
                config={{
                    displayModeBar: false,
                    staticPlot: true,
                }}
                data={traces}
                layout={layout}
                style={{ width: '100%', height: '100%' }}
                useResizeHandler={true}
            />
        </div>
    );
};
