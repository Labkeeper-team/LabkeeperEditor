/**
 * Звук с микрофона в lpcm для распознавания: моно, 16 бит со знаком,
 * little-endian, без заголовка WAV (спека v4, recognizeSpeech)
 */

/** 16 кГц хватает для речи, и 30 секунд укладываются в 1 МБ */
export const PCM_SAMPLE_RATE = 16000;

/**
 * Склеивает куски записи и понижает частоту усреднением: каждый выходной
 * отсчёт это среднее входных, попавших в его промежуток. Так высокие
 * частоты не заворачиваются в слышимые, как при простом прореживании
 */
export function downsample(
    chunks: readonly Float32Array[],
    inputRate: number,
    outputRate: number = PCM_SAMPLE_RATE
): Float32Array {
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const input = new Float32Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        input.set(chunk, offset);
        offset += chunk.length;
    }
    if (outputRate >= inputRate) {
        return input;
    }
    const ratio = inputRate / outputRate;
    const output = new Float32Array(Math.floor(total / ratio));
    for (let index = 0; index < output.length; index++) {
        const from = Math.floor(index * ratio);
        const to = Math.min(total, Math.floor((index + 1) * ratio));
        let sum = 0;
        for (let sample = from; sample < to; sample++) {
            sum += input[sample];
        }
        output[index] = to > from ? sum / (to - from) : 0;
    }
    return output;
}

/** Отсчёты от -1 до 1 в 16-битный PCM little-endian */
export function toPcm16(samples: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(samples.length * 2);
    const view = new DataView(buffer);
    for (let index = 0; index < samples.length; index++) {
        const sample = Math.max(-1, Math.min(1, samples[index]));
        view.setInt16(
            index * 2,
            sample < 0 ? sample * 0x8000 : sample * 0x7fff,
            true
        );
    }
    return buffer;
}
