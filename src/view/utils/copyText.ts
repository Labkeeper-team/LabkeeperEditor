/**
 * Текст в буфер обмена. navigator.clipboard есть только на HTTPS и
 * localhost, поэтому без него копируем через выделенное поле
 */
export const copyText = async (text: string) => {
    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return;
        } catch {
            // браузер не дал доступа к буферу: пробуем по-старому
        }
    }
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    // iOS Safari выделяет поле только так
    field.setSelectionRange(0, text.length);
    try {
        if (!document.execCommand('copy')) {
            throw new Error('copy rejected');
        }
    } finally {
        field.remove();
    }
};
