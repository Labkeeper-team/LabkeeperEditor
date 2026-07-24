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
const paletteSize = TAG_COLOR_SWATCHES.length;

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

export const normalizeTagLabel = (value: string): string =>
    value.trim().replace(/\s+/g, ' ');

export const getNextSuggestedTagColor = (
    knownColors: string[],
    currentColor?: string
): string => {
    const normalizedKnown = new Set(
        knownColors.map((color) => color.toLocaleLowerCase())
    );
    const normalizedCurrent = currentColor?.toLocaleLowerCase();
    const currentIndex = currentColor
        ? TAG_COLOR_SWATCHES.findIndex((color) => color === normalizedCurrent)
        : -1;

    for (let step = 1; step <= paletteSize; step += 1) {
        const index = (currentIndex + step) % paletteSize;
        const candidate = TAG_COLOR_SWATCHES[index];
        if (!normalizedKnown.has(candidate)) {
            return candidate;
        }
    }

    return TAG_COLOR_SWATCHES[(currentIndex + 1) % paletteSize];
};

export const orderTagKeysSelectedFirst = (
    allTagKeys: string[],
    selectedTagKeys: Iterable<string>
): string[] => {
    const selectedSet = new Set(selectedTagKeys);
    const selected = allTagKeys.filter((tagKey) => selectedSet.has(tagKey));
    const unselected = allTagKeys.filter((tagKey) => !selectedSet.has(tagKey));
    return [...selected, ...unselected];
};
