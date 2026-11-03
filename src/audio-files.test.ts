import { afterEach, expect, it, vi } from "vitest";
import { readAudio } from "./audio-files";
import { wavBytes } from "./sounds";
import { audioDataValid } from "./media-model";

afterEach(() => vi.unstubAllGlobals());
it("preserves upload bytes when Web Audio detaches its decoding input", async () => {
  vi.stubGlobal(
    "Audio",
    class {
      duration = 1;
      onloadedmetadata?: () => void;
      set src(_url: string) {
        queueMicrotask(() => this.onloadedmetadata?.());
      }
      removeAttribute() {}
      load() {}
    },
  );
  const close = vi.fn();
  vi.stubGlobal(
    "AudioContext",
    class {
      decodeAudioData(buffer: ArrayBuffer) {
        structuredClone(buffer, { transfer: [buffer] });
        expect(buffer.byteLength).toBe(0);
        return Promise.resolve({
          duration: 1,
          numberOfChannels: 1,
          sampleRate: 24000,
        });
      }
      close = close;
    },
  );
  const original = wavBytes([new Float32Array(24000)], 24000),
    file = new File([original as Uint8Array<ArrayBuffer>], "original.wav", {
      type: "audio/wav",
    });
  const result = await readAudio(file);
  expect(audioDataValid(result)).toBe(true);
  expect(Buffer.from(result.dataUrl.split(",")[1], "base64")).toEqual(
    Buffer.from(original),
  );
  expect(close).toHaveBeenCalledOnce();
});
