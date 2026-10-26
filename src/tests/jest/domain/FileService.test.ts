import { dictionary } from '../../../viewModel/dictionaries/index.ts';
import { Events } from '../../../model/service/ObserverService.ts';
import { mockContext } from '../common.ts';

jest.mock('react-toastify', () => ({ toast: jest.fn() }));

const ru = dictionary.ru;

const TEXT = '\\ProvidesClass{altacv}\n';
const BINARY = 'PK\u0003\u0004\u0000\u0000';

function fileOf(
    name: string,
    type = '',
    sizeInBytes?: number,
    content = TEXT
): File {
    const file = new File([content], name, { type });
    // File из jsdom считает размер по содержимому: подменяем, чтобы проверить лимит
    if (sizeInBytes !== undefined) {
        Object.defineProperty(file, 'size', { value: sizeInBytes });
    }
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
    async (name) => {
        const { fileService, onEvent } = setup();

        expect(await fileService.checkFile(fileOf(name), ru)).toBe(true);
        expect(onEvent).not.toHaveBeenCalledWith(
            Events.EVENT_FILE_UPLOAD_REJECTED,
            expect.anything()
        );
    }
);

// Браузер почти никогда не знает MIME у .cls и .sty: решать должно содержимое
test.each(['', 'application/octet-stream'])(
    'класс принимается при MIME "%s"',
    async (mime) => {
        const { fileService } = setup();

        expect(
            await fileService.checkFile(fileOf('altacv.cls', mime), ru)
        ).toBe(true);
    }
);

// GH-209: текст принимается с любым расширением, список вручную не пополняется
test.each([
    'babel-russian.ldf',
    'figure.tikz',
    'biblatex.cfg',
    'measurements.dat',
    'latexmkrc',
    'notes.whatever',
])('текстовый файл принимается с любым расширением: %s', async (name) => {
    const { fileService, onEvent } = setup();

    expect(await fileService.checkFile(fileOf(name), ru)).toBe(true);
    expect(onEvent).not.toHaveBeenCalledWith(
        Events.EVENT_FILE_UPLOAD_REJECTED,
        expect.anything()
    );
});

test('пустой файл считается текстом', async () => {
    const { fileService } = setup();

    expect(
        await fileService.checkFile(fileOf('empty.def', '', undefined, ''), ru)
    ).toBe(true);
});

// PDF вставляют в LaTeX как картинку и отдают агенту из чата, MIME у него не из списка
test.each(['', 'application/pdf'])(
    'PDF принимается при MIME "%s"',
    async (mime) => {
        const { fileService, onEvent } = setup();

        expect(
            await fileService.checkFile(
                fileOf('report.pdf', mime, undefined, BINARY),
                ru
            )
        ).toBe(true);
        expect(onEvent).not.toHaveBeenCalledWith(
            Events.EVENT_FILE_UPLOAD_REJECTED,
            expect.anything()
        );
    }
);

// GH-209: у EPS бывает двоичный заголовок превью, он принимается по расширению
test.each(['figure.eps', 'FIGURE.EPS', 'plot.ps'])(
    'двоичный %s принимается',
    async (name) => {
        const { fileService } = setup();

        expect(
            await fileService.checkFile(
                fileOf(name, 'application/postscript', undefined, BINARY),
                ru
            )
        ).toBe(true);
    }
);

test('прежние форматы по-прежнему принимаются', async () => {
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
        expect(await fileService.checkFile(fileOf(name), ru)).toBe(true);
    }
});

test('картинка принимается по MIME и с двоичным содержимым', async () => {
    const { fileService } = setup();

    expect(
        await fileService.checkFile(
            fileOf('photo.webp', 'image/webp', undefined, BINARY),
            ru
        )
    ).toBe(true);
});

test('двоичный файл неизвестного формата отклоняется и уходит в аналитику', async () => {
    const { fileService, onEvent } = setup();

    expect(
        await fileService.checkFile(
            fileOf('archive.zip', 'application/zip', undefined, BINARY),
            ru
        )
    ).toBe(false);
    expect(onEvent).toHaveBeenCalledWith(
        Events.EVENT_FILE_UPLOAD_REJECTED,
        expect.objectContaining({ reason: 'format', extension: 'zip' })
    );
});

test('слишком большой файл отклоняется с причиной too_big', async () => {
    const { fileService, onEvent } = setup();
    const sixMb = 6 * 1048576;

    expect(await fileService.checkFile(fileOf('big.tex', '', sixMb), ru)).toBe(
        false
    );
    expect(onEvent).toHaveBeenCalledWith(
        Events.EVENT_FILE_UPLOAD_REJECTED,
        expect.objectContaining({ reason: 'too_big', extension: 'tex' })
    );
});

// В аналитику уходит расширение и размер, но не имя файла: оно принадлежит пользователю
test('имя отклонённого файла в аналитику не уходит', async () => {
    const { fileService, onEvent } = setup();

    await fileService.checkFile(
        fileOf('секретный-отчёт.zip', '', undefined, BINARY),
        ru
    );

    const payload = JSON.stringify(onEvent.mock.calls);
    expect(payload).not.toContain('секретный-отчёт');
});

// GH-188: удалённый агентом файл держит имя, пока по удалению не решили
describe('calculateNumberFile', () => {
    test('a name held by a file the agent deleted gets a number', () => {
        const { fileService, repository } = setup();
        repository.ideViewModelRepository.setHunks([
            {
                id: 'del',
                type: 'deleteFile',
                fileName: 'new.txt',
                text: 'old content',
            },
        ]);

        expect(fileService.calculateNumberFile(null, 'new.txt')).toBe(
            'new(1).txt'
        );
        expect(fileService.calculateNumberFile(null, 'other.txt')).toBe(
            'other.txt'
        );
    });

    test('a file the agent deleted inside a folder holds its name there only', () => {
        const { fileService, repository } = setup();
        repository.ideViewModelRepository.setHunks([
            {
                id: 'del',
                type: 'deleteFile',
                fileName: 'docs/new.txt',
                text: 'old content',
            },
        ]);

        expect(fileService.calculateNumberFile(null, 'new.txt', 'docs')).toBe(
            'docs/new(1).txt'
        );
        expect(fileService.calculateNumberFile(null, 'new.txt')).toBe(
            'new.txt'
        );
    });
});
