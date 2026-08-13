import { LabkeeperFile } from '../../model/domain.ts';

/** Нормализует путь файла проекта (без ведущего `/`). */
export function normalizeProjectFilePath(path: string): string {
    return path.replace(/^\/+/, '');
}

/**
 * Сопоставляет путь из API (navigation `file` / error `latexFile`)
 * с `fileName` из списка файлов проекта.
 */
export function resolveProjectFileName(
    files: LabkeeperFile[],
    requested: string
): string | null {
    if (!requested) {
        return null;
    }
    const normalized = normalizeProjectFilePath(requested);
    const exact = files.find((file) => {
        const name = normalizeProjectFilePath(file.fileName);
        return (
            file.fileName === requested ||
            name === normalized ||
            file.fileName === normalized
        );
    });
    if (exact) {
        return exact.fileName;
    }

    const baseName = normalized.includes('/')
        ? normalized.slice(normalized.lastIndexOf('/') + 1)
        : normalized;
    const byBase = files.filter((file) => {
        const name = normalizeProjectFilePath(file.fileName);
        const fileBase = name.includes('/')
            ? name.slice(name.lastIndexOf('/') + 1)
            : name;
        return fileBase === baseName;
    });
    if (byBase.length === 1) {
        return byBase[0].fileName;
    }
    return byBase[0]?.fileName ?? null;
}

export function projectFilePathsMatch(
    left: string | null | undefined,
    right: string | null | undefined
): boolean {
    if (!left || !right) {
        return false;
    }
    return normalizeProjectFilePath(left) === normalizeProjectFilePath(right);
}
