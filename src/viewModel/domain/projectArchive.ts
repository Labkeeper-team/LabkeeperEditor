import { PROJECT_TITLE_MAX_LENGTH } from '../../model/domain.ts';

/** GH-234: импорт принимает только zip, остальное отсеиваем до загрузки */
const ZIP_TYPES = ['application/zip', 'application/x-zip-compressed'];

export const isZipArchive = (file: File): boolean =>
    file.name.toLowerCase().endsWith('.zip') || ZIP_TYPES.includes(file.type);

/**
 * Имя проекта по имени архива. Экспорт кладёт архив под именем проекта:
 * «Лабораторная 3.zip» или «Лабораторная 3 (LaTeX).zip», и при импорте
 * имя возвращается без хвостов
 */
export const archiveProjectName = (fileName: string): string =>
    fileName
        .replace(/\.zip$/i, '')
        .replace(/\s*\(LaTeX\)$/, '')
        .trim()
        .slice(0, PROJECT_TITLE_MAX_LENGTH);
