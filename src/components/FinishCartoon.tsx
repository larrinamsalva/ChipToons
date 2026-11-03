import { useEffect, useRef, useState } from "react";
import type { Project } from "../model";
import { totalDuration, durationLabel } from "../model";
import {
  exportVideo,
  supportedVideoFormats,
  exportLimit,
} from "../video-export";
import type { ExportSettings, ExportProgress } from "../video-export";
import { exportProject, downloadBlob, safeFilename } from "../files";
import { captionText, srt, audioPlan } from "../production";
import { Modal } from "./Modal";
import { Stage } from "./Stage";
import { CaptionOverlay } from "./CaptionOverlay";
import { AudioDecodeCache } from "../audio-engine";
import { SegmentExports } from "./SegmentExports";
import { ReadinessChecklist } from "./ReadinessChecklist";
import { productionReadiness } from "../readiness";
export function FinishCartoon({
  project,
  onClose,
  onVoices,
  onCaptions,
  onPreview,
  saveStatus,
  onScene,
}: {
  project: Project;
  onClose: () => void;
  onVoices: () => void;
  onCaptions: () => void;
  onPreview: (sound: boolean) => void;
  saveStatus: string;
  onScene: (index: number, panel?: "voices" | "captions") => void;
}) {
  const [formats] = useState(supportedVideoFormats),
    mobile = window.matchMedia("(max-width:740px)").matches;
  const [audioCache] = useState(() => new AudioDecodeCache());
  const blocking = productionReadiness(
    project,
    exportLimit(),
    !!formats.length,
  ).some((i) => i.blocking && !i.id.startsWith("limit:"));
  const [settings, setSettings] = useState<ExportSettings>({
      mime: formats[0] ?? "",
      width: 800,
      fps: 15,
      captions: true,
      audio: true,
    }),
    [running, setRunning] = useState(false),
    [progress, setProgress] = useState<ExportProgress | null>(null),
    [error, setError] = useState("");
  const [result, setResult] = useState<{
      blob: Blob;
      url: string;
      frames: number;
      width: number;
      height: number;
    } | null>(null),
    controller = useRef<AbortController | null>(null),
    alive = useRef(true),
    total = totalDuration(project),
    active = audioPlan(project, 0, total);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
      audioCache.clear();
    };
  }, [audioCache]);
  useEffect(
    () => () => {
      if (result) URL.revokeObjectURL(result.url);
    },
    [result],
  );
  async function makeVideo() {
    if (running) return;
    setRunning(true);
    setResult(null);
    setError("");
    const abort = new AbortController();
    controller.current = abort;
    try {
      const movie = await exportVideo(
        project,
        settings,
        abort.signal,
        (p) => {
          if (alive.current) setProgress(p);
        },
        audioCache,
      );
      if (alive.current)
        setResult({
          blob: movie.blob,
          url: URL.createObjectURL(movie.blob),
          frames: movie.frames,
          width: movie.width,
          height: movie.height,
        });
    } catch (e) {
      if (alive.current)
        setError(
          e instanceof Error
            ? e.message
            : "The export could not finish. Your saved project is unchanged.",
        );
    } finally {
      if (alive.current) setRunning(false);
      controller.current = null;
    }
  }
  return (
    <Modal
      title="Finish My Cartoon"
      onClose={() => {
        controller.current?.abort();
        onClose();
      }}
      wide
    >
      <p className="section-description">
        Review your story, listen once, then make a real WebM movie. Export runs
        on this device and does not record the editor or your screen.
      </p>
      <div className="finish-review">
        <div>
          <span>Cartoon</span>
          <strong>{project.title}</strong>
        </div>
        <div>
          <span>Scenes</span>
          <strong>{project.scenes.length}</strong>
        </div>
        <div>
          <span>Story length</span>
          <strong>{durationLabel(total)}</strong>
        </div>
        <div>
          <span>Audio clips</span>
          <strong>
            {active.length} active · {project.audioAssets.length} sources
          </strong>
        </div>
        <div>
          <span>Timed captions</span>
          <strong>{project.captions.length}</strong>
        </div>
        <div>
          <span>Local save</span>
          <strong>{saveStatus}</strong>
        </div>
      </div>
      <ReadinessChecklist
        project={project}
        limit={exportLimit()}
        supported={!!formats.length}
        saveStatus={saveStatus}
        onReview={(issue) => {
          if (issue.sceneIndex !== undefined)
            onScene(
              issue.sceneIndex,
              issue.action === "voices" || issue.action === "captions"
                ? issue.action
                : undefined,
            );
          else if (issue.action === "voices") onVoices();
          else if (issue.action === "captions") onCaptions();
          else if (issue.action === "browser" || issue.action === "backup")
            exportProject(project);
        }}
      />

      {(!active.length ||
        project.mixer.muted ||
        project.mixer.master === 0) && (
        <p className="media-notice">
          The cartoon currently has no audible mix. Add a voice or sound, or
          check the mixer’s mute and master level.
        </p>
      )}
      <div className="animation-actions">
        <button
          className="button secondary"
          disabled={running}
          onClick={onVoices}
        >
          Edit voices & sound
        </button>
        <button
          className="button secondary"
          disabled={running}
          onClick={onCaptions}
        >
          Edit captions
        </button>
        <button
          className="button secondary"
          disabled={running}
          onClick={() => onPreview(settings.audio)}
        >
          Preview complete cartoon
        </button>
      </div>
      <section className="export-settings">
        <h3>Movie settings</h3>
        <div className="form-grid">
          <label>
            Supported video format
            <select
              aria-label="Video export format"
              value={settings.mime}
              disabled={running || !formats.length}
              onChange={(e) =>
                setSettings({ ...settings, mime: e.target.value })
              }
            >
              {formats.length ? (
                formats.map((f) => (
                  <option value={f} key={f}>
                    {f.includes("vp8")
                      ? "WebM · VP8 + Opus"
                      : "WebM · VP9 + Opus"}
                  </option>
                ))
              ) : (
                <option value="">No verified browser encoder</option>
              )}
            </select>
          </label>
          <label>
            Video resolution
            <select
              aria-label="Video export resolution"
              value={settings.width}
              disabled={running}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  width: Number(e.target.value) as 800 | 1280,
                })
              }
            >
              <option value="800">800 × 450</option>
              {!mobile && <option value="1280">1280 × 720</option>}
            </select>
          </label>
          <label>
            Video frame rate
            <select
              aria-label="Video export frame rate"
              value={settings.fps}
              disabled={running}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  fps: Number(e.target.value) as 15 | 24,
                })
              }
            >
              <option value="15">15 fps · lighter</option>
              {!mobile && <option value="24">24 fps</option>}
            </select>
          </label>
          <div className="export-checks">
            <label className="inline-check">
              <input
                type="checkbox"
                checked={settings.audio}
                disabled={running}
                onChange={(e) =>
                  setSettings({ ...settings, audio: e.target.checked })
                }
              />
              Include mixed audio
            </label>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={settings.captions}
                disabled={running}
                onChange={(e) =>
                  setSettings({ ...settings, captions: e.target.checked })
                }
              />
              Include timed captions
            </label>
          </div>
        </div>
        <p className="field-hint">
          Export takes about the cartoon’s running time. Keep this tab visible.
          The limit is {exportLimit()} seconds on this device; recordings and
          artwork remain saved if export fails. MP4 is not offered in this
          release.
        </p>
        {!formats.length && (
          <p className="media-notice" role="status">
            This browser does not provide the required canvas/WebM/Web Audio
            exporter. You can keep a project backup, storyboard and SRT, and try
            a current Chromium browser.
          </p>
        )}
        {total > exportLimit() && (
          <p className="media-notice">
            This story exceeds one movie’s limit. Use the whole-scene parts
            below to keep every scene.
          </p>
        )}
        <details className="export-visual-preview">
          <summary>Preview export settings</summary>
          <p className="field-hint">
            First scene at 0.5 seconds. Audio is mixed during cartoon preview
            and export.
          </p>
          <div className="live-stage">
            <Stage project={project} scene={project.scenes[0]} time={0.5} />
            {settings.captions && (
              <CaptionOverlay
                text={captionText(project, 0.5)}
                style={project.captionStyle}
              />
            )}
          </div>
        </details>
        <div className="animation-actions">
          <button
            className="button primary"
            disabled={
              running || blocking || !formats.length || total > exportLimit()
            }
            onClick={() => void makeVideo()}
          >
            Export complete cartoon
          </button>
          {running && (
            <button
              className="button secondary"
              onClick={() => controller.current?.abort()}
            >
              Cancel video export
            </button>
          )}
        </div>
        {progress && (
          <div className="export-progress">
            <progress
              aria-label="Video export progress"
              value={progress.fraction}
              max="1"
            />
            <p role="status">
              {progress.phase} · {progress.seconds.toFixed(1)}s /{" "}
              {total.toFixed(1)}s
            </p>
          </div>
        )}
        {error && (
          <p role="alert" className="media-notice">
            {error}
          </p>
        )}
        {result && (
          <div className="finished-movie">
            <h3>Your movie is ready</h3>
            <video
              controls
              playsInline
              src={result.url}
              aria-label="Completed cartoon video"
            />
            <p className="field-hint">
              Playable WebM · {result.width}×{result.height} ·{" "}
              {(result.blob.size / 1024 / 1024).toFixed(2)} MB · {result.frames}{" "}
              scene renders
            </p>
            <button
              className="button primary"
              onClick={() =>
                downloadBlob(result.blob, `${safeFilename(project.title)}.webm`)
              }
            >
              Download completed video
            </button>
          </div>
        )}
      </section>
      <SegmentExports
        project={project}
        settings={settings}
        cache={audioCache}
        busy={running}
        available={!!formats.length && !blocking}
        onBusy={(value) => {
          setRunning(value);
          if (value) {
            setResult(null);
            setProgress(null);
            setError("");
          }
        }}
        onController={(c) => {
          controller.current = c;
        }}
        onScene={onScene}
      />
      <div className="modal-actions">
        <button
          className="button secondary"
          disabled={running}
          onClick={() => exportProject(project)}
        >
          Download portable project
        </button>
        <button
          className="button secondary"
          disabled={running}
          onClick={() =>
            downloadBlob(
              new Blob([srt(project)], {
                type: "application/x-subrip;charset=utf-8",
              }),
              `${safeFilename(project.title)}.srt`,
            )
          }
        >
          Download SRT subtitles
        </button>
        <button
          className="button secondary"
          onClick={() => {
            controller.current?.abort();
            onClose();
          }}
        >
          Back to studio
        </button>
      </div>
    </Modal>
  );
}
