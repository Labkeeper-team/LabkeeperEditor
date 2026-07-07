export const DEFAULT_TAG_COLOR = 'blue';

export const TAG_COLOR_SWATCHES = [
    'blue',
    'orange',
    'red',
    'purple',
    'cyan',
    'lime',
    'deeppink',
    'deepskyblue',
    'darkorange',
    'green',
    'violet',
    'teal',
    'yellow',
    'indigo',
    'pink',
    'olive',
];

export const normalizeColorInput = (value: string): string | null => {
    const prepared = value.trim();
    if (!prepared) {
        return null;
    }
    if (typeof window !== 'undefined' && window.CSS?.supports) {
        if (!window.CSS.supports('color', prepared)) {
            return null;
        }
    }
    return prepared;
};
