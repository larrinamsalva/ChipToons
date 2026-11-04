import { checkDeliveryAbort } from "./delivery-bytes";
import type { Project } from "./model";
import { formatSrt, subtitleCues } from "./production";
import { EXPORT_RECORDING_LEAD_SECONDS } from "./segments";
import { verifyVideo } from "./video-export";
import {
  MOVIE_BYTES, MOVIE_STAGING_DIRECTORY, moviePlanProblem, movieSpaceNeeded,
} from "./single-movie-plan";
import type { MoviePart, MovieProgress, MovieRange, MovieWorkerMessage, MovieWorkerRequest } from "./single-movie-plan";

export interface VerifiedMovie {
  video: Blob;
  duration: number;
  width: number;
  height: number;
  ranges: MovieRange[];
  keepForDownload: () => void;
  release: () => void;
}

function runWorker(request: MovieWorkerRequest, signal: AbortSignal, onProgress: (progress: MovieProgress) => void) {
  checkDeliveryAbort(signal);
  const worker = new Worker(new URL("./single-movie.worker.ts", import.meta.url), { type: "module" });
  return new Promise<MovieRange[]>((resolve, reject) => {
    let cancelTimer: ReturnType<typeof setTimeout> | undefined;
    let finished = false;
    function finish(message: MovieWorkerMessage) {
      if (finished) return;
      finished = true;
      clearTimeout(cancelTimer);
      signal.removeEventListener("abort", cancel);
      worker.terminate();
      if (signal.aborted) reject(new DOMException("Movie assembly cancelled.", "AbortError"));
      else if (message.type === "done") resolve(message.ranges);
      else if (message.type === "error") reject(new Error(message.message));
    }
    function cancel() {
      worker.postMessage("cancel");
      cancelTimer = setTimeout(() => finish({ type: "error", message: "Movie assembly cancelled." }), 2000);
    }
    worker.addEventListener("message", (event: MessageEvent<MovieWorkerMessage>) => {
      if (event.data.type === "progress") {
        if (!signal.aborted) onProgress(event.data.progress);
      } else finish(event.data);
    });
    const unsupported = () => finish({
      type: "error", message: "The browser could not open the local movie worker. Your originals and checked parts are still available.",
    });
    worker.addEventListener("error", unsupported);
    worker.addEventListener("messageerror", unsupported);
    signal.addEventListener("abort", cancel, { once: true });
    try { worker.postMessage(request); } catch { unsupported(); }
  });
}

async function removeOldStagingFiles(directory: FileSystemDirectoryHandle, signal: AbortSignal) {
  const expired = Date.now() - 24 * 60 * 60 * 1000;
  const entries = directory as FileSystemDirectoryHandle & { values(): AsyncIterable<FileSystemHandle> };
  if (typeof entries.values !== "function") return;
  for await (const handle of entries.values()) {
    checkDeliveryAbort(signal);
    if (handle.kind === "file" && /^staged-[0-9a-f-]{36}\.webm$/.test(handle.name)) {
      const name = handle.name;
      await navigator.locks.request(`chiptoons-movie-file:${name}`, { ifAvailable: true }, async lock => {
        if (!lock) return;
        const file = await (await directory.getFileHandle(name)).getFile();
        if (file.lastModified < expired) await directory.removeEntry(name);
      }).catch(() => {});
    }
  }
}

export async function makeSingleMovie(parts: MoviePart[], signal: AbortSignal,
  onProgress: (progress: MovieProgress) => void): Promise<VerifiedMovie> {
  const problem = moviePlanProblem(parts);
  if (problem) throw new Error(problem);
  return navigator.locks.request("chiptoons-movie-build", { ifAvailable: true }, async lock => {
    if (!lock) throw new Error("Another tab is making a movie. Try again when it finishes.");
    checkDeliveryAbort(signal);
    const directory = await (await navigator.storage.getDirectory()).getDirectoryHandle(MOVIE_STAGING_DIRECTORY, { create: true });
    await removeOldStagingFiles(directory, signal);
    const { quota, usage } = await navigator.storage.estimate();
    checkDeliveryAbort(signal);
    if (quota === undefined || usage === undefined || quota - usage < movieSpaceNeeded(parts))
      throw new Error("There isn’t enough estimated local storage for this movie. Free some space or keep the checked episode ZIP.");
    const name = `staged-${crypto.randomUUID()}.webm`;
    let unlock!: () => void;
    const lease = new Promise<void>(resolve => { unlock = resolve; });
    await new Promise<void>((resolve, reject) => {
      void navigator.locks.request(`chiptoons-movie-file:${name}`, () => { resolve(); return lease; }).catch(reject);
    });
    const remove = () => { void directory.removeEntry(name).catch(() => {}).finally(unlock); };
    try {
      onProgress({ label: "Preparing local movie storage", fraction: 0 });
      const ranges = await runWorker({ parts, directory, name }, signal, onProgress);
      checkDeliveryAbort(signal);
      const file = await (await directory.getFileHandle(name)).getFile();
      if (file.size > MOVIE_BYTES) throw new Error("The assembled movie exceeded the local limit.");
      const video = file.slice(0, file.size, "video/webm");
      const end = ranges.at(-1)!.end;
      const checks = ranges.slice(1).flatMap(({ start }) => [start - 0.05, start + 0.2]);
      checks.push(end - 0.25);
      onProgress({ label: "Checking playback and seeking across the joins", fraction: 0.93 });
      const verified = await verifyVideo(video, signal, checks);
      if (!Number.isFinite(verified.duration) || Math.abs(verified.duration - end) > 0.06 ||
          verified.width !== parts[0].media.width || verified.height !== parts[0].media.height)
        throw new Error("The finished file’s duration or picture size failed verification. Keep the checked individual parts.");
      checkDeliveryAbort(signal);
      let downloadUntil = 0, released = false;
      return { ...verified, video, ranges,
        keepForDownload() { downloadUntil = Date.now() + 120_000; },
        release() {
          if (released) return;
          released = true;
          const delay = downloadUntil - Date.now();
          if (delay > 0) setTimeout(remove, delay);
          else remove();
        },
      };
    } catch (error) {
      remove();
      if (error instanceof DOMException && (error.name === "QuotaExceededError" || error.name === "NotAllowedError"))
        throw new Error("This browser couldn’t reserve enough local space. Your checked individual parts are still available.", { cause: error });
      throw error;
    }
  });
}

export function singleMovieSrt(project: Project, plan: { start: number; end: number }[], ranges: MovieRange[]) {
  return formatSrt(plan.flatMap((segment, index) => {
    const range = ranges[index];
    const lead = range.start + EXPORT_RECORDING_LEAD_SECONDS;
    return subtitleCues(project, segment).map(cue => ({
      start: lead + cue.start, end: Math.min(range.end, lead + cue.end), text: cue.text,
    })).filter(cue => Math.round(cue.end * 1000) > Math.round(cue.start * 1000));
  }));
}
