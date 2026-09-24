// настоящий pdf.mjs в jsdom не грузится, а copy здесь не проверяется
jest.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
    normalizeUnicode: (text: string) => text,
}));

import { PdfTextSelection } from '../../../view/pages/project/viewer/result/textSelection.ts';

// слой как у TextLayer из pdf.js: span на каждую строку и размер страницы в инлайн-стиле
const makeLayer = (lines: string[]) => {
    const layer = document.createElement('div');
    layer.className = 'textLayer';
    layer.style.width = '600px';
    layer.style.height = '800px';
    for (const line of lines) {
        const span = document.createElement('span');
        span.textContent = line;
        layer.append(span);
    }
    document.body.append(layer);
    return layer;
};

const selectInside = (layer: HTMLElement) => {
    const text = layer.querySelector('span')!.firstChild!;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 3);
    const selection = document.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
};

let textSelection: PdfTextSelection;
let layers: HTMLElement[];
let appends: jest.SpyInstance[];

beforeEach(() => {
    textSelection = new PdfTextSelection();
    layers = [0, 1, 2].map((page) =>
        makeLayer([`page ${page} first line`, `page ${page} second line`])
    );
    layers.forEach((layer) => textSelection.add(layer));
    appends = layers.map((layer) => jest.spyOn(layer, 'append'));
});

afterEach(() => {
    textSelection.clear();
    document.getSelection()?.removeAllRanges();
    document.body.innerHTML = '';
});

test('selectionchange and keyup outside the PDF leave already reset layers alone', () => {
    document.getSelection()!.removeAllRanges();
    document.dispatchEvent(new Event('selectionchange'));
    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'a' }));

    appends.forEach((append) => expect(append).not.toHaveBeenCalled());
    layers.forEach((layer) => {
        const end = layer.lastElementChild as HTMLElement;
        expect(end.className).toBe('endOfContent');
        expect(end.style.width).toBe('');
        expect(layer.classList.contains('selecting')).toBe(false);
    });
});

test('a layer the selection has left is reset once and then left alone', () => {
    const [first, second] = layers;
    selectInside(first);
    const end = first.querySelector('.endOfContent') as HTMLElement;
    expect(first.classList.contains('selecting')).toBe(true);
    expect(end.style.width).toBe('600px');
    expect(first.lastElementChild).not.toBe(end);

    selectInside(second);
    expect(first.lastElementChild).toBe(end);
    expect(end.style.width).toBe('');
    expect(end.style.height).toBe('');
    expect(first.classList.contains('selecting')).toBe(false);
    expect(appends[0]).toHaveBeenCalledTimes(1);

    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'a' }));
    expect(appends[0]).toHaveBeenCalledTimes(1);
    expect(appends[2]).not.toHaveBeenCalled();
    // слой под выделением keyup сбрасывает, как в pdf.js
    expect(second.classList.contains('selecting')).toBe(false);
    expect(appends[1]).toHaveBeenCalledTimes(1);
});

test('a press on the text without a drag is undone on pointerup', () => {
    const [first] = layers;
    first.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(first.classList.contains('selecting')).toBe(true);

    document.dispatchEvent(new Event('pointerup'));
    expect(first.classList.contains('selecting')).toBe(false);
});
