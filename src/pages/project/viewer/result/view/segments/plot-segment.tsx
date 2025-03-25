import Plot from 'react-plotly.js';

interface PlotItem {
    x: number[],
    y: number[],
    type: 'scatter' | 'histogram' | 'line',
    color: string,
    name: string,
    xInfl: number[],
    yInfl: number[]
}

interface PlotSegmentProps {
    title: string;
    xAxis: string;
    yAxis: string;
    plots: PlotItem[];
    legendVisible: boolean;
}

export const PlotSegment = ({title, xAxis, yAxis, plots, legendVisible}: PlotSegmentProps) => {
    const traces = plots.map(plot => ({
        x: plot.x,
        y: plot.type !== 'histogram' ? plot.y : undefined,
        type: plot.type,
        name: plot.name,
        text: plot.type === 'scatter' ? plot.name : undefined,
        mode: plot.type === 'scatter' ? 'markers' : (plot.type === 'line' ? 'lines' : undefined),
        line: {
            color: plot.color
        },
        error_y: {
            type: 'data',
            array: plot.yInfl,
            visible: plot.yInfl.length > 0 && plot.type === 'scatter'
        },
        error_x: {
            type: 'data',
            array: plot.xInfl,
            visible: plot.xInfl.length > 0 && plot.type === 'scatter'
        }
    }));

    const layout = {
        title: {
            text: title
        },
        showlegend: legendVisible,
        xaxis: {
            title: {
                text: xAxis
            }
        },
        yaxis: {
            title: {
                text: yAxis,
            }
        },
        margin: {
            t: 40,
            b: 60,
            l: 80,
            r: 20
        }
    };

    return (
        <div style={{ height: "100%", width: "100%" }}>
            <Plot
                config={{
                    displayModeBar: false,
                    staticPlot: true
                }}
                data={traces}
                layout={layout}
                style={{ width: '100%', height: '100%' }}
                useResizeHandler={true}
            />
        </div>
    );
};