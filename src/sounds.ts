import { uid } from "./model";
import type { AudioAsset } from "./media-model";

export const SOUNDS = [
  ["melody", "Kindness melody", "music", 8],
  ["steps", "Little footsteps", "effects", 2],
  ["door", "Door opening / closing", "effects", 1.1],
  ["laugh", "Gentle synthesized laughter", "effects", 1.4],
  ["applause", "Soft applause", "effects", 2],
  ["sparkle", "Magical sparkle", "effects", 1.8],
  ["wind", "Soft wind", "effects", 3],
  ["rain", "Gentle rain", "effects", 3],
  ["birds", "Little birds", "effects", 2.2],
  ["notice", "Friendly notification", "effects", 0.8],
  ["transition", "Gentle transition", "effects", 1.2],
] as const;
export type SoundId = (typeof SOUNDS)[number][0];
export function wavBytes(
  channels: Float32Array[],
  sampleRate: number,
): Uint8Array {
  const length = channels[0].length,
    bytes = new Uint8Array(44 + length * channels.length * 2),
    view = new DataView(bytes.buffer);
  const word = (at: number, s: string) =>
    [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  word(0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  word(8, "WAVE");
  word(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels.length, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels.length * 2, true);
  view.setUint16(32, channels.length * 2, true);
  view.setUint16(34, 16, true);
  word(36, "data");
  view.setUint32(40, bytes.length - 44, true);
  for (let i = 0; i < length; i++)
    for (let c = 0; c < channels.length; c++)
      view.setInt16(
        44 + (i * channels.length + c) * 2,
        Math.round(Math.max(-1, Math.min(1, channels[c][i])) * 32767),
        true,
      );
  return bytes;
}
export function audioUrl(bytes: Uint8Array, mime = "audio/wav") {
  let text = "";
  for (let i = 0; i < bytes.length; i += 32768)
    text += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return `data:${mime};base64,${btoa(text)}`;
}
const cache = new Map<string, { dataUrl: string; duration: number }>();
export function builtInSound(id: SoundId): AudioAsset {
  const sound = SOUNDS.find((s) => s[0] === id)!;
  let cached = cache.get(id);
  if (!cached) {
    const duration = sound[3],
      rate = 24000,
      data = new Float32Array(Math.round(duration * rate));
    let seed = 173,
      brown = 0;
    for (let i = 0; i < data.length; i++) {
      const t = i / rate;
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = seed / 2147483648 - 1;
      brown = brown * 0.97 + noise * 0.03;
      const sine = (f: number) => Math.sin(2 * Math.PI * f * t),
        env = Math.min(1, t / 0.025, (duration - t) / 0.08);
      let value: number;
      if (id === "melody") {
        const notes = [
          261.63, 329.63, 392, 329.63, 349.23, 440, 392, 329.63, 261.63, 329.63,
          392, 523.25, 440, 392, 329.63, 293.66,
        ];
        const n = Math.floor(t * 2),
          phase = t % 0.5;
        value =
          (sine(notes[n % notes.length]) * 0.12 +
            sine(notes[n % notes.length] / 2) * 0.06) *
          Math.exp(-phase * 5);
      } else if (id === "steps")
        value = noise * 0.23 * Math.exp(-(t % 0.35) * 35);
      else if (id === "door")
        value =
          (sine(125 + Math.sin(t * 4) * 45) * 0.08 + noise * 0.025) *
          Math.sin((Math.PI * t) / duration);
      else if (id === "laugh")
        value =
          sine(240 + Math.sin(t * 10) * 55) *
          0.12 *
          Math.max(0, Math.sin(t * 14));
      else if (id === "applause")
        value =
          noise *
          0.18 *
          (0.35 + 0.65 * Math.abs(Math.sin(t * 31))) *
          Math.sin((Math.PI * t) / duration);
      else if (id === "sparkle")
        value =
          (sine(660 + Math.floor(t * 4) * 110) +
            sine(990 + Math.floor(t * 4) * 110)) *
          0.07 *
          Math.exp(-(t % 0.25) * 7);
      else if (id === "wind")
        value = brown * 0.5 * (0.6 + 0.3 * Math.sin(t * 2));
      else if (id === "rain")
        value = noise * 0.06 + (seed % 143 === 0 ? noise * 0.22 : 0);
      else if (id === "birds")
        value =
          sine(1200 + Math.sin(t * 20) * 380) *
          0.08 *
          Math.max(0, Math.sin(t * 5)) ** 3;
      else if (id === "notice")
        value =
          sine(t < 0.4 ? 440 : 660) *
          0.12 *
          Math.sin((Math.PI * (t % 0.4)) / 0.4);
      else
        value = sine(220 + t * 160) * 0.1 * Math.sin((Math.PI * t) / duration);
      data[i] = value * Math.max(0, env);
    }
    cached = { dataUrl: audioUrl(wavBytes([data], rate)), duration };
    cache.set(id, cached);
  }
  return {
    id: uid(),
    name: sound[1],
    mime: "audio/wav",
    dataUrl: cached.dataUrl,
    duration: cached.duration,
    channels: 1,
    sampleRate: 24000,
  };
}
