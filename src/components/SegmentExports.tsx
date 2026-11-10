import { useEffect, useRef, useState } from "react";
import type { Project } from "../model";
import { durationLabel } from "../model";
import { planSegments, exportRange } from "../segments";
import type { ExportSegment } from "../segments";
import { exportLimit, exportVideo } from "../video-export";
import type { ExportSettings, ExportProgress } from "../video-export";
import type { AudioDecodeCache } from "../audio-engine";
import { downloadBlob, safeFilename } from "../files";
import { srt } from "../production";
import { deliveryDigest } from "../delivery-bytes";
import { partTag, rememberExportReceipt } from "../episode-delivery";
import type { ExportReceipt } from "../episode-delivery";
import { MediaNumber } from "./MediaNumber";

const checkpointKey = (p: Project) => `chiptoons-export-parts:${p.id}`;
function recoverParts(p: Project) {
  const fallback = {
    status: {} as Record<string, string>,
    limit: exportLimit(),
    first: 0,
    last: p.scenes.length - 1,
  };
  try {
    const saved = JSON.parse(localStorage.getItem(checkpointKey(p)) ?? "null");
    if (
      saved?.version !== 1 ||
      saved.revision !== p.updatedAt ||
      !saved.status ||
      typeof saved.status !== "object"
    )
      return fallback;
    const first =
      Number.isInteger(saved.first) &&
      saved.first >= 0 &&
      saved.first < p.scenes.length
        ? saved.first
        : 0;
    const last =
      Number.isInteger(saved.last) &&
      saved.last >= first &&
      saved.last < p.scenes.length
        ? saved.last
        : p.scenes.length - 1;
    const limit =
      Number.isFinite(saved.limit) &&
      saved.limit >= 2 &&
      saved.limit <= exportLimit()
        ? saved.limit
        : exportLimit();
    const status = Object.fromEntries(
      Object.entries(saved.status)
        .filter(([key, value]) => key.length < 210 && typeof value === "string")
        .slice(0, 120)
        .map(([key, value]) => [
          key,
          value === "Rendering" || value === "Ready to download"
            ? "Retry available"
            : String(value),
        ]),
    );
    return { status, limit, first, last };
  } catch {
    return fallback;
  }
}
export function SegmentExports({
  project,
  settings,
  cache,
  busy,
  available,
  onBusy,
  onController,
  onScene,
  onPreview,
  onDelivery,
  sceneRequest,
}: {
  project: Project;
  sceneRequest?: { sceneIndex: number; serial: number };
  settings: ExportSettings;
  cache: AudioDecodeCache;
  busy: boolean;
  available: boolean;
  onBusy: (value: boolean) => void;
  onController: (c: AbortController | null) => void;
  onScene: (index: number) => void;
  onPreview: (retained: boolean) => void;
  onDelivery: (limit: number, focus: (part: ExportSegment, index: number) => void) => void;
}) {
  const [segmentRunning, setSegmentRunning] = useState(false);
  const [recovered] = useState(() => recoverParts(project));
  const [limit, setLimit] = useState(recovered.limit),
    [first, setFirst] = useState(recovered.first),
    [last, setLast] = useState(recovered.last),
    [progress, setProgress] = useState<ExportProgress | null>(null),
    [error, setError] = useState(""),
    [status, setStatus] = useState(recovered.status);
  const [result, setResult] = useState<{
    segment: ExportSegment;
    label: string;
    tag: string;
    blob: Blob;
    url: string;
    downloaded: boolean;
    width: number;
    height: number;
    receipt?: ExportReceipt;
  } | null>(null);
  const alive = useRef(true),
    controller = useRef<AbortController | null>(null),
    plan = planSegments(project, limit),
    chosen = exportRange(project, { firstScene: first, lastScene: last });
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(
        checkpointKey(project),
        JSON.stringify({
          version: 1,
          revision: project.updatedAt,
          status,
          limit,
          first,
          last,
        }),
      );
    } catch {
      /* Export progress still works without settings storage. */
    }
  }, [project, status, limit, first, last]);
  const resultUrl = result?.url;
  useEffect(
    () => () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    },
    [resultUrl],
  );
  const exportRangeDetails = useRef<HTMLDetailsElement>(null);
  const rangeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!sceneRequest) return;
    const sceneIndex = sceneRequest.sceneIndex;
    if (!Number.isInteger(sceneIndex) || sceneIndex < 0 ||
        sceneIndex >= project.scenes.length) return;
    // Handle the user's explicit shortcut on the next frame, not as a
    // synchronous cascading state update inside a React effect.
    let focusFrame = 0;
    const frame = requestAnimationFrame(() => {
      setFirst(sceneIndex);
      setLast(sceneIndex);
      if (exportRangeDetails.current) exportRangeDetails.current.open = true;
      focusFrame = requestAnimationFrame(() => {
        rangeButton.current?.scrollIntoView({ block: "center" });
        rangeButton.current?.focus();
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(focusFrame);
    };
  }, [sceneRequest, project.scenes.length]);
  function focusPart(part: ExportSegment, index: number) {
    const planned = plan.segments[index]?.id === part.id;
    if (!planned) {
      setFirst(part.firstScene);
      setLast(part.lastScene);
      if (exportRangeDetails.current) exportRangeDetails.current.open = true;
    }
    requestAnimationFrame(() => {
      const button = planned ? document.getElementById(`episode-export-part-${index}`) : rangeButton.current;
      button?.scrollIntoView({ block: "center" });
      button?.focus();
    });
  }
  const locked = busy || !available || !!(result && !result.downloaded);
  async function render(segment: ExportSegment, label: string, tag: string) {
    if (locked) return;
    const abort = new AbortController();
    controller.current = abort;
    onController(abort);
    onBusy(true);
    setSegmentRunning(true);
    setResult(null);
    onPreview(false);
    setError("");
    setProgress(null);
    setStatus((s) => ({ ...s, [segment.id]: "Rendering" }));
    try {
      const movie = await exportVideo(
        project,
        { ...settings, range: segment },
        abort.signal,
        (p) => {
          if (alive.current) setProgress(p);
        },
        cache,
      );
      const digest = await deliveryDigest(movie.blob, abort.signal).catch(problem => {
        if (abort.signal.aborted) throw problem;
        return undefined;
      });
      if (alive.current) {
        onPreview(true);
        setResult({
          segment,
          label,
          tag,
          blob: movie.blob,
          url: URL.createObjectURL(movie.blob),
          downloaded: false,
          width: movie.width,
          height: movie.height,
          ...(digest ? { receipt: {
            first: segment.firstScene, last: segment.lastScene, start: segment.start, end: segment.end,
            width: movie.width, height: movie.height, size: movie.blob.size, sha256: digest.sha256,
            fps: settings.fps, audio: settings.audio, captions: settings.captions,
          } } : {}),
        });
        setStatus((s) => ({ ...s, [segment.id]: "Ready to download" }));
      }
    } catch (e) {
      if (alive.current) {
        setError(
          e instanceof Error
            ? e.message
            : "This part could not finish. Your project is safe.",
        );
        setStatus((s) => ({ ...s, [segment.id]: "Retry available" }));
      }
    } finally {
      // Every segment is encoded as a self-contained movie. Its decoded audio
      // buffers are no longer needed once the encoder has finished or failed.
      // Release them before the next part so consecutive two-minute exports
      // cannot accumulate up to 64 MB of audio cache in a long session.
      // Original audio files remain untouched in project storage.
      cache.clear();
      if (alive.current) {
        onBusy(false);
        setSegmentRunning(false);
        onController(null);
      }
      controller.current = null;
    }
  }
  function download() {
    if (!result) return;
    downloadBlob(
      result.blob,
      `${safeFilename(project.title)}-${result.tag}.webm`,
    );
    if (result.receipt) rememberExportReceipt(project, result.receipt);
    setStatus((s) => ({ ...s, [result.segment.id]: "Downloaded" }));
    setResult({ ...result, downloaded: true });
  }
  return (
    <section className="segment-exports" aria-label="Scene segment exports">
      <h3>Longer story? Make it in parts.</h3>
      <button id="prepare-episode-delivery" className="button primary" disabled={busy}
        onClick={() => onDelivery(limit, focusPart)}>Prepare My Complete Episode</button>
      <p>
        Export consecutive whole scenes as playable WebM parts. Watch them in
        order. Every scene appears once in the plan below. This does not create
        one uninterrupted 20-minute movie.
      </p>
      <MediaNumber
        label="Maximum seconds per segment"
        value={limit}
        min={2}
        max={exportLimit()}
        step={1}
        onChange={(n) => {
          if (!busy) setLimit(n);
        }}
      />
      {plan.oversized.length > 0 ? (
        <div role="alert" className="media-notice">
          <p>
            A whole scene is longer than this limit. Shorten it or raise the
            part limit within this device’s maximum. No scenes have been
            dropped.
          </p>
          {plan.oversized.map((i) => (
            <button
              className="button secondary small"
              key={i}
              onClick={() => onScene(i)}
            >
              Review scene {i + 1} · {project.scenes[i].duration}s
            </button>
          ))}
        </div>
      ) : (
        <ol className="segment-list">
          {plan.segments.map((s, i) => (
            <li key={s.id}>
              <div>
                <strong>Segment {i + 1}</strong>
                <span>
                  Scenes {s.firstScene + 1}–{s.lastScene + 1} ·{" "}
                  {durationLabel(s.duration)} · story {durationLabel(s.start)}–
                  {durationLabel(s.end)}
                </span>
                <span role="status">{status[s.id] ?? "Not exported"}</span>
              </div>
              <button
                className="button secondary"
                id={`episode-export-part-${i}`}
                disabled={locked}
                onClick={() =>
                  void render(
                    s,
                    `Segment ${i + 1}`,
                    partTag(i, s),
                  )
                }
              >
                {status[s.id] === "Retry available" ? "Retry" : "Export"}{" "}
                segment {i + 1}
              </button>
              <button
                className="button text small"
                disabled={busy}
                onClick={() =>
                  downloadBlob(
                    new Blob([srt(project, s)], {
                      type: "application/x-subrip;charset=utf-8",
                    }),
                    `${safeFilename(project.title)}-part-${i + 1}.srt`,
                  )
                }
              >
                Segment {i + 1} subtitles
              </button>
            </li>
          ))}
        </ol>
      )}
      <details ref={exportRangeDetails}>
        <summary>Choose a different whole-scene range</summary>
        <div className="form-grid">
          <label>
            First scene
            <select
              aria-label="Export first scene"
              value={first}
              disabled={busy}
              onChange={(e) => {
                const n = Number(e.target.value);
                setFirst(n);
                if (last < n) setLast(n);
              }}
            >
              {project.scenes.map((s, i) => (
                <option key={s.id} value={i}>
                  {i + 1}. {s.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Last scene
            <select
              aria-label="Export last scene"
              value={last}
              disabled={busy}
              onChange={(e) => setLast(Number(e.target.value))}
            >
              {project.scenes.map((s, i) =>
                i >= first ? (
                  <option key={s.id} value={i}>
                    {i + 1}. {s.title}
                  </option>
                ) : null,
              )}
            </select>
          </label>
        </div>
        <p>
          Selected scenes: {durationLabel(chosen.duration)}. Audio and subtitles
          start at the matching point in your story.
        </p>
        {chosen.duration > exportLimit() && (
          <p className="media-notice">
            Choose fewer scenes. This range exceeds {exportLimit()} seconds.
          </p>
        )}
        <button
          className="button secondary"
          ref={rangeButton}
          disabled={locked || chosen.duration > exportLimit()}
          onClick={() =>
            void render(
              chosen,
              `Scenes ${first + 1}–${last + 1}`,
              `scenes-${first + 1}-${last + 1}`,
            )
          }
        >
          Export selected scene range
        </button>
      </details>
      {segmentRunning && (
        <button
          className="button secondary"
          onClick={() => controller.current?.abort()}
        >
          Cancel this segment
        </button>
      )}
      {progress && (
        <div className="export-progress">
          <progress
            aria-label="Segment export progress"
            value={progress.fraction}
            max={1}
          />
          <p role="status">
            {progress.phase} · {progress.seconds.toFixed(1)}s
          </p>
        </div>
      )}
      {error && (
        <p className="media-notice" role="alert">
          {error} Retry only this part when you’re ready.
        </p>
      )}
      {result && (
        <div className="finished-movie">
          <h4>{result.label} is ready</h4>
          <video
            controls
            playsInline
            src={result.url}
            aria-label="Completed segment video"
          />
          <p>
            {result.width}×{result.height} ·{" "}
            {durationLabel(result.segment.duration)} · original scenes{" "}
            {result.segment.firstScene + 1}–{result.segment.lastScene + 1}
          </p>
          <button className="button primary" onClick={download}>
            Download {result.label.toLowerCase()}
          </button>
          <button
            className="button text"
            onClick={() => {
              setResult(null);
              onPreview(false);
              if (!result.downloaded)
                setStatus((s) => ({
                  ...s,
                  [result.segment.id]: "Preview discarded; export again",
                }));
            }}
          >
            {result.downloaded
              ? "Close segment preview"
              : "Discard this preview"}
          </button>
        </div>
      )}
      {result && !result.downloaded && (
        <p className="field-hint">
          Download this finished part before making the next one. Only one part
          preview is kept in memory.
        </p>
      )}
      <p className="field-hint">
        Saved parts stay in your Downloads. If you close this review or refresh,
        reopen your project and export any missing part again. Original artwork
        and audio are kept.
      </p>
      <button
        className="button text small"
        disabled={busy || !!plan.oversized.length}
        onClick={() =>
          downloadBlob(
            new Blob(
              [
                JSON.stringify(
                  {
                    title: project.title,
                    parts: plan.segments.map((s, i) => ({
                      order: i + 1,
                      firstScene: s.firstScene + 1,
                      lastScene: s.lastScene + 1,
                      start: s.start,
                      end: s.end,
                      seconds: s.duration,
                      sceneIds: project.scenes
                        .slice(s.firstScene, s.lastScene + 1)
                        .map((s) => s.id),
                    })),
                  },
                  null,
                  2,
                ),
              ],
              { type: "application/json" },
            ),
            `${safeFilename(project.title)}-part-order.json`,
          )
        }
      >
        Download part order
      </button>
    </section>
  );
}
