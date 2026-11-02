import { uid } from "./model";
import {
  AUDIO_MIMES,
  MAX_AUDIO_BYTES,
  MAX_AUDIO_SECONDS,
  audioSignature,
} from "./media-model";
import type { AudioAsset, AudioMime } from "./media-model";
import { audioUrl, wavBytes } from "./sounds";

export function dataBytes(url: string) {
  return Uint8Array.from(atob(url.slice(url.indexOf(",") + 1)), (c) =>
    c.charCodeAt(0),
  );
}
export function metadataDuration(blob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob),
      audio = new Audio(),
      timer = setTimeout(
        () =>
          finish(
            new Error(
              "Audio metadata could not be read. Try a short WAV or MP3.",
            ),
          ),
        8000,
      );
    function finish(error?: Error, duration?: number) {
      clearTimeout(timer);
      audio.onloadedmetadata = null;
      audio.onerror = null;
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(url);
      if (error) reject(error);
      else resolve(duration!);
    }
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const d = audio.duration;
      if (!Number.isFinite(d) || d <= 0 || d > MAX_AUDIO_SECONDS)
        finish(
          new Error(
            "Choose audio with a readable duration of up to 120 seconds. WAV and MP3 are dependable choices.",
          ),
        );
      else finish(undefined, d);
    };
    audio.onerror = () =>
      finish(
        new Error(
          "This browser cannot decode this audio file. Try WAV or MP3.",
        ),
      );
    audio.src = url;
  });
}
export async function decodeAsset(
  context: AudioContext,
  asset: AudioAsset,
): Promise<AudioBuffer> {
  const bytes = dataBytes(asset.dataUrl);
  if (!audioSignature(bytes, asset.mime))
    throw new Error(`${asset.name} is not a valid audio file.`);
  await metadataDuration(
    new Blob([bytes as Uint8Array<ArrayBuffer>], { type: asset.mime }),
  );
  let buffer: AudioBuffer;
  try {
    buffer = await context.decodeAudioData(bytes.buffer as ArrayBuffer);
  } catch {
    throw new Error(
      `${asset.name} could not be decoded. Its original is still saved in the project.`,
    );
  }
  if (
    buffer.duration > MAX_AUDIO_SECONDS + 0.01 ||
    buffer.numberOfChannels > 2 ||
    Math.abs(buffer.duration - asset.duration) > 0.2
  )
    throw new Error(
      `${asset.name} has inconsistent audio metadata. Replace it with a short mono or stereo recording.`,
    );
  return buffer;
}
export async function readAudio(
  file: File,
  recordingSeconds?: number,
): Promise<AudioAsset> {
  let mime = file.type.toLowerCase().split(";")[0];
  if (["audio/x-wav", "audio/wave", "audio/vnd.wave"].includes(mime))
    mime = "audio/wav";
  if (
    !AUDIO_MIMES.includes(mime as AudioMime) ||
    !file.size ||
    file.size > MAX_AUDIO_BYTES
  )
    throw new Error(
      "Choose a WAV, MP3, Ogg or audio WebM under 12 MB that this browser can decode.",
    );
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!audioSignature(bytes, mime))
    throw new Error("The file’s contents do not match its audio type.");
  if (recordingSeconds === undefined) await metadataDuration(file);
  else if (recordingSeconds > 61)
    throw new Error("Recordings can be up to 60 seconds long.");
  if (!globalThis.AudioContext)
    throw new Error(
      "This browser does not provide Web Audio decoding. Keep your original and try a current Chromium browser.",
    );
  const context = new AudioContext({ sampleRate: 24000 });
  try {
    const buffer = await context.decodeAudioData(bytes.buffer as ArrayBuffer);
    if (
      buffer.duration > MAX_AUDIO_SECONDS ||
      buffer.duration < 0.02 ||
      buffer.numberOfChannels > 2
    )
      throw new Error("Choose mono or stereo audio lasting up to 120 seconds.");
    // Own microphone captures are normalized to a portable WAV with a finite duration.
    const output =
        recordingSeconds === undefined
          ? bytes
          : wavBytes([buffer.getChannelData(0)], buffer.sampleRate),
      type = recordingSeconds === undefined ? (mime as AudioMime) : "audio/wav";
    if (output.length > MAX_AUDIO_BYTES)
      throw new Error("This recording is too large. Keep it under 12 MB.");
    return {
      id: uid(),
      name: file.name.replace(/\.[^.]+$/, "").slice(0, 160) || "My recording",
      mime: type,
      dataUrl: audioUrl(output, type),
      duration: buffer.duration,
      channels: recordingSeconds === undefined ? buffer.numberOfChannels : 1,
      sampleRate: buffer.sampleRate,
    };
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : "Audio decoding failed. Try WAV or MP3.",
      { cause: error },
    );
  } finally {
    await context.close();
  }
}
