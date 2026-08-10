/**
 * Gemini's TTS response is raw signed 16-bit little-endian PCM
 * (`mimeType: "audio/L16;codec=pcm;rate=24000"`), not a playable container. The old
 * app/api/gemini/tts/route.ts discarded that mimeType and handed the client raw PCM
 * bytes labelled `data:audio/wav;base64,...` — a lie the browser's audio decoder
 * rejects every time, which is why the app always fell back to speechSynthesis
 * despite successfully paying for a TTS call (docs/progress/00-baseline-audit.md
 * bug #4). This prepends a real 44-byte RIFF/WAVE header so the bytes are an
 * actual, playable .wav file.
 */
export interface PcmFormat {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
}

const DEFAULT_FORMAT: PcmFormat = { sampleRate: 24_000, channels: 1, bitsPerSample: 16 };

/** Parses `rate=NNNN` out of a mimeType like "audio/L16;codec=pcm;rate=24000". */
export function parsePcmMimeType(mimeType: string): PcmFormat {
  const match = /rate=(\d+)/i.exec(mimeType);
  const sampleRate = match?.[1] ? Number(match[1]) : DEFAULT_FORMAT.sampleRate;
  return { ...DEFAULT_FORMAT, sampleRate };
}

export function pcmToWav(pcm: Uint8Array, format: PcmFormat = DEFAULT_FORMAT): Uint8Array {
  const { sampleRate, channels, bitsPerSample } = format;
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm.byteLength;

  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM = 1
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const wav = new Uint8Array(44 + dataSize);
  wav.set(new Uint8Array(header), 0);
  wav.set(pcm, 44);
  return wav;
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
}
