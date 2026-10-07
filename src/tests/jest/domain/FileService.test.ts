import { dictionary } from '../../../viewModel/dictionaries/index.ts';
import { Events } from '../../../model/service/ObserverService.ts';
import { mockContext } from '../common.ts';

jest.mock('react-toastify', () => ({ toast: jest.fn() }));

const ru = dictionary.ru;

function fileOf(name: string, type = '', sizeInBytes = 1024): File {
    const file = new File(['x'], name, { type });
    // File из jsdom считает размер по содержимому: подменяем, чтобы проверить лимит
    Object.defineProperty(file, 'size', { value: sizeInBytes });
    return file;
}

function setup() {
    const ctx = mockContext();
    const onEvent = jest.spyOn(ctx.observerService, 'onEvent');
    return { ...ctx, onEvent };
}

// Шаблоны вроде AltaCV подключают собственный класс и пакет: без них проект не собирается
test.each(['altacv.cls', 'ALTACV.CLS', 'mystyle.sty', 'MyStyle.STY'])(
    'класс и пакет LaTeX принимаются: %s',
    (name) => {
        const { fileService, onEvent } = setup();

        expect(fileService.checkFile(fileOf(name), ru)).toBe(true);
        expect(onEvent).not.toHaveBeenCalledWith(
            Events.EVENT_FILE_UPLOAD_REJECTED,
            expect.anything()
        );
    }
);

// Браузер почти никогда не знает MIME у .cls и .sty: решать должно расширение
test.each(['', 'application/octet-stream'])(
    'класс принимается при MIME "%s"',
    (mime) => {
        const { fileService } = setup();

        expect(fileService.checkFile(fileOf('altacv.cls', mime), ru)).toBe(
            true
        );
    }
);

// PDF вставляют в LaTeX как картинку и отдают агенту из чата, MIME у него не из списка
test.each(['', 'application/pdf'])('PDF принимается при MIME "%s"', (mime) => {
    const { fileService, onEvent } = setup();

    expect(fileService.checkFile(fileOf('report.pdf', mime), ru)).toBe(true);
    expect(onEvent).not.toHaveBeenCalledWith(
        Events.EVENT_FILE_UPLOAD_REJECTED,
        expect.anything()
    );
});

test('прежние форматы по-прежнему принимаются', () => {
    const { fileService } = setup();

    for (const name of [
        'a.png',
        'b.jpg',
        'c.jpeg',
        'd.svg',
        'e.txt',
        'f.csv',
        'g.tex',
        'h.bib',
        'i.bst',
    ]) {
        expect(fileService.checkFile(fileOf(name), ru)).toBe(true);
    }
});

test('неподдерживаемый формат отклоняется и уходит в аналитику', () => {
    const { fileService, onEvent } = setup();

    expect(fileService.checkFile(fileOf('archive.zip'), ru)).toBe(false);
    expect(onEvent).toHaveBeenCalledWith(
        Events.EVENT_FILE_UPLOAD_REJECTED,
        expect.objectContaining({ reason: 'format', extension: 'zip' })
    );
});

test('слишком большой файл отклоняется с причиной too_big', () => {
    const { fileService, onEvent } = setup();
    const sixMb = 6 * 1048576;

    expect(fileService.checkFile(fileOf('big.tex', '', sixMb), ru)).toBe(false);
    expect(onEvent).toHaveBeenCalledWith(
        Events.EVENT_FILE_UPLOAD_REJECTED,
        expect.objectContaining({ reason: 'too_big', extension: 'tex' })
    );
});

// В аналитику уходит расширение и размер, но не имя файла: оно принадлежит пользователю
test('имя отклонённого файла в аналитику не уходит', () => {
    const { fileService, onEvent } = setup();

    fileService.checkFile(fileOf('секретный-отчёт.zip'), ru);

    const payload = JSON.stringify(onEvent.mock.calls);
    expect(payload).not.toContain('секретный-отчёт');
});
