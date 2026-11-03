import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Project } from "./model";
import { validateProject, totalDuration } from "./model";
import { frameAt } from "./timeline";
import { Stage } from "./components/Stage";
import { captionText } from "./production";
import { paintCaptions } from "./captions";
import { mixingGraph, prepareAudio, scheduleAudio } from "./audio-engine";
import { webmDuration } from "./webm";

export interface ExportSettings {
  mime: string;
  width: 800 | 1280;
  fps: 15 | 24;
  captions: boolean;
  audio: boolean;
}
export interface ExportProgress {
  phase: string;
  seconds: number;
  fraction: number;
}
export function supportedVideoFormats() {
  return typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function" &&
    typeof AudioContext !== "undefined"
    ? ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus"].filter((m) =>
        MediaRecorder.isTypeSupported(m),
      )
    : [];
}
export function exportLimit() {
  return typeof window !== "undefined" &&
    window.matchMedia("(max-width: 740px)").matches
    ? 60
    : 120;
}
const aborted = () =>
  new DOMException(
    "Export cancelled. Your project is unchanged.",
    "AbortError",
  );
function check(signal: AbortSignal) {
  if (signal.aborted) throw aborted();
  if (document.visibilityState === "hidden")
    throw new Error(
      "Keep this tab visible during export. Your saved project is unchanged.",
    );
}
function loadImage(
  url: string,
  signal: AbortSignal,
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image(),
      timer = setTimeout(
        () =>
          finish(
            new Error(
              "Artwork decoding timed out. Try a smaller original image.",
            ),
          ),
        10000,
      );
    const abort = () => finish(aborted());
    function finish(error?: Error) {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      image.onload = null;
      image.onerror = null;
      if (error) {
        image.src = "";
        reject(error);
      } else resolve(image);
    }
    signal.addEventListener("abort", abort, { once: true });
    image.onload = () => finish();
    image.onerror = () =>
      finish(
        new Error(
          "An artwork image could not be decoded. Replace the missing or damaged source.",
        ),
      );
    image.src = url;
    if (signal.aborted) abort();
  });
}
export async function paintStage(
  context: CanvasRenderingContext2D,
  project: Project,
  time: number,
  settings: Pick<ExportSettings, "width" | "captions">,
  signal: AbortSignal,
) {
  check(signal);
  const frame = frameAt(project, time),
    svg = renderToStaticMarkup(
      createElement(Stage, {
        project,
        scene: frame.scene,
        time: frame.localTime,
        labelled: false,
      }),
    ),
    url = URL.createObjectURL(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    );
  try {
    const image = await loadImage(url, signal);
    check(signal);
    context.save();
    context.setTransform(
      settings.width / 800,
      0,
      0,
      settings.width / 800,
      0,
      0,
    );
    context.fillStyle = "#fffaf2";
    context.fillRect(0, 0, 800, 450);
    context.drawImage(image, 0, 0, 800, 450);
    if (settings.captions)
      paintCaptions(context, captionText(project, time), project.captionStyle);
    context.restore();
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function verifyVideo(blob: Blob, signal: AbortSignal) {
  if (blob.size < 1000)
    throw new Error(
      "The encoder produced an empty video. Your project is safe.",
    );
  const url = URL.createObjectURL(blob),
    video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  try {
    return await new Promise<{
      width: number;
      height: number;
      duration: number;
    }>((resolve, reject) => {
      const timer = setTimeout(
          () =>
            finish(
              new Error(
                "This browser could not verify the recorded movie. Try WebM VP8 in a current Chromium browser.",
              ),
            ),
          10000,
        ),
        abort = () => finish(aborted());
      let done = false;
      function finish(error?: Error) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        video.onloadeddata = null;
        video.onerror = null;
        if (error) reject(error);
        else
          resolve({
            width: video.videoWidth,
            height: video.videoHeight,
            duration: video.duration,
          });
      }
      signal.addEventListener("abort", abort, { once: true });
      video.onerror = () =>
        finish(
          new Error("The recorded movie cannot be played by this browser."),
        );
      video.onloadeddata = () => {
        if (!video.videoWidth || !video.videoHeight) {
          finish(new Error("No video frames were recorded."));
          return;
        }
        void video
          .play()
          .then(() => finish())
          .catch(() =>
            finish(new Error("The recorded video could not begin playback.")),
          );
      };
      video.src = url;
      video.load();
      if (signal.aborted) abort();
    });
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
export async function exportVideo(
  source: Project,
  settings: ExportSettings,
  signal: AbortSignal,
  onProgress: (p: ExportProgress) => void,
) {
  const project = validateProject(source),
    duration = totalDuration(project);
  if (!supportedVideoFormats().includes(settings.mime))
    throw new Error(
      "Video export is unavailable in this browser. Project backups, storyboards and subtitles remain available.",
    );
  if (duration > exportLimit())
    throw new Error(
      `Keep a video export to ${exportLimit()} seconds on this device. Split a longer story into shorter project copies.`,
    );
  if (![800, 1280].includes(settings.width) || ![15, 24].includes(settings.fps))
    throw new Error("Choose supported export settings.");
  const height = (settings.width * 450) / 800,
    canvas = document.createElement("canvas");
  canvas.width = settings.width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering is unavailable.");
  const audio = new AudioContext(),
    nodes = new Set<AudioBufferSourceNode>(),
    pending = new AbortController(),
    workSignal = AbortSignal.any([signal, pending.signal]);
  let stream: MediaStream | undefined,
    captured: MediaStream | undefined,
    mixed: MediaStream | undefined,
    recorder: MediaRecorder | undefined,
    graph: ReturnType<typeof mixingGraph> | undefined;
  try {
    await audio.resume();
    check(signal);
    onProgress({ phase: "Preparing artwork…", seconds: 0, fraction: 0 });
    for (const asset of project.assets) {
      await loadImage(asset.dataUrl, signal);
      check(signal);
    }
    const buffers = settings.audio
      ? await prepareAudio(audio, project, (phase) =>
          onProgress({ phase, seconds: 0, fraction: 0 }),
        )
      : new Map<string, AudioBuffer>();
    check(signal);
    await paintStage(context, project, 0, settings, signal);
    captured = canvas.captureStream(settings.fps);
    const destination = audio.createMediaStreamDestination();
    mixed = destination.stream;
    graph = mixingGraph(audio, destination, project.mixer);
    stream = new MediaStream([
      ...captured.getVideoTracks(),
      ...(settings.audio ? destination.stream.getAudioTracks() : []),
    ]);
    recorder = new MediaRecorder(stream, {
      mimeType: settings.mime,
      videoBitsPerSecond: settings.width === 800 ? 2000000 : 3500000,
      audioBitsPerSecond: 128000,
    });
    const chunks: BlobPart[] = [];
    let bytes = 0,
      rejectRecording: (e: Error) => void = () => {};
    const recorded = new Promise<Blob>((resolve, reject) => {
      rejectRecording = reject;
      recorder!.ondataavailable = (e) => {
        if (e.data.size) {
          chunks.push(e.data);
          bytes += e.data.size;
          if (bytes > 80 * 1024 * 1024) {
            reject(
              new Error(
                "This video exceeded the 80 MB recording limit. Try a shorter cartoon.",
              ),
            );
            if (recorder?.state !== "inactive") recorder?.stop();
          }
        }
      };
      recorder!.onerror = () =>
        reject(
          new Error(
            "The browser’s video encoder stopped. Try VP8, 800×450 and 15 fps.",
          ),
        );
      recorder!.onstop = () =>
        resolve(new Blob(chunks, { type: settings.mime.split(";")[0] }));
    });
    // Install a handler immediately so encoder errors are never unhandled while rendering.
    void recorded.catch(() => {});
    const fail = () => rejectRecording(aborted());
    signal.addEventListener("abort", fail, { once: true });
    try {
      recorder.start(250);
      const recordingStart = audio.currentTime;
      const anchor = audio.currentTime + 0.15;
      if (settings.audio)
        scheduleAudio(
          audio,
          project,
          buffers,
          graph,
          0,
          duration,
          anchor,
          nodes,
        );
      let frames = 1,
        lastFrame = -1,
        lastTime = 0,
        renderError: Error | undefined;
      const render = async () => {
        while (true) {
          check(workSignal);
          if (audio.state !== "running")
            throw new Error(
              "Audio timing was interrupted. Keep the tab active and try again.",
            );
          const time = Math.max(0, audio.currentTime - anchor);
          if (time - lastTime > 0.5)
            throw new Error(
              "Frame timing was interrupted. Keep the tab visible and try 800×450, 15 fps or a shorter cartoon.",
            );
          lastTime = time;
          if (time >= duration) break;
          const frame = Math.floor(time * settings.fps);
          if (frame !== lastFrame) {
            const before = performance.now();
            await paintStage(context, project, time, settings, workSignal);
            (
              captured!.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack
            ).requestFrame?.();
            frames++;
            lastFrame = frame;
            if (performance.now() - before > 1500)
              throw new Error(
                "This device is rendering too slowly. Use 800×450, 15 fps or a shorter cartoon.",
              );
            onProgress({
              phase: "Recording your cartoon…",
              seconds: Math.min(time, duration),
              fraction: Math.min(0.99, time / duration),
            });
          }
          await new Promise<void>((resolve, reject) => {
            const abort = () => {
              clearTimeout(handle);
              reject(aborted());
            };
            // Encoding must not depend on compositor RAF delivery, which can
            // pause for an occluded canvas even while its audio clock runs.
            const delay = Math.min(
              1000 / settings.fps,
              Math.max(
                4,
                ((lastFrame + 1) / settings.fps -
                  (audio.currentTime - anchor)) *
                  1000,
              ),
            );
            const handle = setTimeout(() => {
              workSignal.removeEventListener("abort", abort);
              resolve();
            }, delay);
            workSignal.addEventListener("abort", abort, { once: true });
          });
        }
      };
      await Promise.race([
        render().catch((e) => {
          renderError = e;
          throw e;
        }),
        recorded.then(() => {
          if (audio.currentTime - anchor < duration - 0.1 && !signal.aborted)
            throw new Error("The encoder stopped before the cartoon finished.");
        }),
      ]);
      if (renderError) throw renderError;
      check(signal);
      await paintStage(
        context,
        project,
        Math.max(0, duration - 0.001),
        settings,
        signal,
      );
      if (recorder.state !== "inactive") recorder.stop();
      const raw = await recorded,
        elapsed = audio.currentTime - recordingStart,
        blob = new Blob(
          [
            webmDuration(
              new Uint8Array(await raw.arrayBuffer()),
              elapsed,
            ) as Uint8Array<ArrayBuffer>,
          ],
          { type: raw.type },
        );
      check(signal);
      onProgress({
        phase: "Checking the playable movie…",
        seconds: duration,
        fraction: 0.99,
      });
      const verified = await verifyVideo(blob, signal);
      if (verified.width !== settings.width || verified.height !== height)
        throw new Error("The recorded video has unexpected dimensions.");
      onProgress({
        phase: "Ready to download",
        seconds: duration,
        fraction: 1,
      });
      return {
        blob,
        mime: settings.mime,
        duration,
        frames,
        width: settings.width,
        height,
        audio: settings.audio,
      };
    } finally {
      signal.removeEventListener("abort", fail);
    }
  } finally {
    pending.abort();
    if (recorder && recorder.state !== "inactive")
      try {
        recorder.stop();
      } catch {
        /* Encoder already closed. */
      }
    nodes.forEach((n) => {
      try {
        n.stop();
        n.disconnect();
      } catch {
        /* Already ended. */
      }
    });
    graph?.dispose();
    stream?.getTracks().forEach((t) => t.stop());
    captured?.getTracks().forEach((t) => t.stop());
    mixed?.getTracks().forEach((t) => t.stop());
    await audio.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}
