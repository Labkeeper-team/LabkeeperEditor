/**
 * Скачивает файл под понятным именем. Архив лежит на другом домене хранилища,
 * а там атрибут download браузер не слушает, поэтому файл забирается целиком
 * и отдаётся из памяти. Если хранилище не пустило запрос, браузер переходит
 * по адресу сам: архив при этом тоже скачивается, только под своим именем
 */
export const downloadFile = async (
    url: string,
    fileName: string
): Promise<void> => {
    const link = document.createElement('a');
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`download-${response.status}`);
        }
        const objectUrl = URL.createObjectURL(await response.blob());
        link.href = objectUrl;
        link.download = fileName;
        // ссылку отзываем позже: Safari начинает скачивание не сразу после щелчка
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60 * 1000);
    } catch {
        link.href = url;
    }
    document.body.append(link);
    link.click();
    link.remove();
};
