import { downsample, toPcm16 } from '../../web/voice/pcm.ts';

// GH-271: Chrome и Safari пишут голос в PCM, а сервер ждёт 16 кГц, 16 бит LE

test('куски записи склеиваются и усредняются до 16 кГц', () => {
    const chunks = [
        new Float32Array([0.3, 0.3, 0.3, 0.6]),
        new Float32Array([0.6, 0.6, 1, 0, 0.5]),
    ];

    const samples = downsample(chunks, 48000, 16000);

    expect(Array.from(samples)).toEqual([
        expect.closeTo(0.3),
        expect.closeTo(0.6),
        expect.closeTo(0.5),
    ]);
});

test('30 секунд записи на 48 кГц укладываются в 1 МБ', () => {
    const second = new Float32Array(48000);

    const pcm = toPcm16(
        downsample(
            Array.from({ length: 30 }, () => second),
            48000
        )
    );

    expect(pcm.byteLength).toBe(30 * 16000 * 2);
    expect(pcm.byteLength).toBeLessThanOrEqual(1024 * 1024);
});

test('отсчёты становятся 16-битными со знаком, младший байт первым', () => {
    const pcm = toPcm16(new Float32Array([1, -1, 0, 0.5, 2]));
    const view = new DataView(pcm);

    expect(
        Array.from({ length: 5 }, (_, index) => view.getInt16(index * 2, true))
    ).toEqual([32767, -32768, 0, 16383, 32767]);
    // little-endian: 32767 это 0xff, 0x7f
    expect(Array.from(new Uint8Array(pcm, 0, 2))).toEqual([0xff, 0x7f]);
});

test('частоту не повышаем: такая запись уходит как есть', () => {
    const samples = downsample([new Float32Array([0.1, 0.2])], 16000, 16000);

    expect(Array.from(samples)).toEqual([
        expect.closeTo(0.1),
        expect.closeTo(0.2),
    ]);
});
