/** Кнопки ссылок PDF, которые у нас что-то делают: переход к назначению и именованное действие */
export type PdfLinkHandlers = {
    goToDestination: (dest: string | unknown[]) => void;
    executeNamedAction: (action: string) => void;
};

/** Link service для AnnotationLayer без PDFViewer: LinkAnnotationElement из pdf.mjs зовёт только эти методы, а PDFLinkService потянул бы весь просмотрщик pdf.js */
export function createPdfLinkService({
    goToDestination,
    executeNamedAction,
}: PdfLinkHandlers) {
    return {
        externalLinkEnabled: true,
        eventBus: null,
        // внешняя ссылка уходит в новую вкладку, чтобы не закрыть редактор, и без доступа к нему через opener
        addLinkAttributes(link: HTMLAnchorElement, url: string) {
            link.href = url;
            link.title = url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
        },
        // адреса у внутренних ссылок нет: переход делает onclick, а хеш редактору ни к чему
        getDestinationHash: () => '#',
        getAnchorUrl: () => '#',
        goToDestination,
        executeNamedAction,
        executeSetOCGState: () => {},
    };
}
