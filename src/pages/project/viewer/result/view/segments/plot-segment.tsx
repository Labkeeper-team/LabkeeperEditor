import Plot from 'react-plotly.js';

interface Curve {
    x: number[],
    y: number[],
    type: 'scatter' | 'histogram' | 'line',
    color: string,
    name: string
}

interface PlotSegmentProps {
    title: string;
    xAxis: string;
    yAxis: string;
    curves: Curve[];
}

export const PlotSegment = ({title, xAxis, yAxis, curves}: PlotSegmentProps) => {
    const traces = curves.map(curve => ({
        x: curve.x,
        y: curve.type !== 'histogram' ? curve.y : undefined,
        type: curve.type,
        name: curve.name,
        text: curve.type === 'scatter' ? curve.name : undefined,
        mode: curve.type === 'scatter' ? 'markers' : (curve.type === 'line' ? 'lines' : undefined),
        line: {
            color: curve.color
        }
    }));

    const layout = {
        title: {
            text: title
        },
        showlegend: true,
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