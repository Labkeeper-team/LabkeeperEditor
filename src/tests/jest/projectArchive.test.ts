import {
    archiveProjectName,
    isZipArchive,
} from '../../viewModel/domain/projectArchive.ts';

// GH-234: экспорт кладёт архив под именем проекта, импорт его возвращает
test.each([
    ['Лабораторная 3.zip', 'Лабораторная 3'],
    ['Лабораторная 3 (LaTeX).zip', 'Лабораторная 3'],
    ['REPORT.ZIP', 'REPORT'],
    ['  отчёт .zip', 'отчёт'],
    ['архив.zip.zip', 'архив.zip'],
])('имя проекта из %s', (fileName, name) => {
    expect(archiveProjectName(fileName)).toBe(name);
});

test('длинное имя обрезается до предела имени проекта', () => {
    expect(archiveProjectName(`${'а'.repeat(80)}.zip`)).toHaveLength(60);
});

test.each([
    ['project.zip', '', true],
    ['project', 'application/zip', true],
    ['project', 'application/x-zip-compressed', true],
    ['report.pdf', 'application/pdf', false],
    ['main.tex', 'text/x-tex', false],
])('%s с MIME «%s» это zip: %s', (name, type, expected) => {
    expect(isZipArchive(new File(['x'], name, { type }))).toBe(expected);
});
