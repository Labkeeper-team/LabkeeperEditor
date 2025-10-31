export const getGrid = () => {
    return {
        splitLine: {
            show: true,
            lineStyle: {
                color: '#bdc1c7 ',
                width: 1,
                type: 'solid',
            },
        },
        axisLine: {
            show: true,
            lineStyle: {
                color: '#6b7280',
                width: 1.5,
            },
        },
        axisTick: {
            show: true,
            length: 6,
            lineStyle: {
                color: '#6b7280',
                width: 1.5,
            },
            interval: (index: number) => {
                return index % 4 === 0;
            },
        },
        minorTick: {
            show: true,
            length: 3,
            lineStyle: {
                color: '#9ca3af',
                width: 0.5,
            },
            interval: (index: number) => {
                return index % 4 !== 0;
            },
        },
        axisLabel: {
            show: true,
            interval: (index: number) => {
                return index % 4 === 0;
            },
            formatter: function (value: number) {
                if (value > 1000000) {
                    return value.toExponential(2);
                } else if (value >= 1000) {
                    return (value / 1000).toFixed(1) + 'K';
                }
                return value;
            },
        },
        minorSplitLine: {
            show: true,
            lineStyle: {
                color: '#d1d5db',
                width: 0.6,
                type: 'solid',
            },
            interval: (index: number) => {
                return index % 4 !== 0;
            },
        },
        z: 10,
    };
};
