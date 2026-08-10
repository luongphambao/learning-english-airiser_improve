import { describe, expect, it } from 'vitest';
import { parsePcmMimeType, pcmToWav } from '../pcm-to-wav';

describe('lib/audio/pcm-to-wav', () => {
  it('parsePcmMimeType extracts the sample rate Gemini reports', () => {
    expect(parsePcmMimeType('audio/L16;codec=pcm;rate=24000').sampleRate).toBe(24000);
    expect(parsePcmMimeType('audio/L16;rate=16000;codec=pcm').sampleRate).toBe(16000);
  });

  it('parsePcmMimeType falls back to 24000 when no rate is present', () => {
    expect(parsePcmMimeType('audio/L16').sampleRate).toBe(24000);
  });

  it('produces a valid 44-byte RIFF/WAVE header followed by the PCM bytes unchanged', () => {
    const pcm = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const wav = pcmToWav(pcm, { sampleRate: 24000, channels: 1, bitsPerSample: 16 });

    expect(wav.byteLength).toBe(44 + pcm.byteLength);

    const view = new DataView(wav.buffer);
    const ascii = (offset: number, len: number) =>
      String.fromCharCode(...wav.slice(offset, offset + len));

    expect(ascii(0, 4)).toBe('RIFF');
    expect(view.getUint32(4, true)).toBe(36 + pcm.byteLength);
    expect(ascii(8, 4)).toBe('WAVE');
    expect(ascii(12, 4)).toBe('fmt ');
    expect(view.getUint16(20, true)).toBe(1); // PCM format tag
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(24000); // sample rate
    expect(view.getUint16(34, true)).toBe(16); // bits per sample
    expect(ascii(36, 4)).toBe('data');
    expect(view.getUint32(40, true)).toBe(pcm.byteLength);

    // the raw PCM payload itself is copied verbatim after the header
    expect(Array.from(wav.slice(44))).toEqual(Array.from(pcm));
  });
});
