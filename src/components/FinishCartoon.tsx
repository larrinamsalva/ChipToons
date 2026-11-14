import { STORY_CARD_STUDIO } from "../story-card-model";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { Project } from "../model";
import { totalDuration, durationLabel } from "../model";
import {
  exportVideo,
  supportedVideoFormats,
  exportLimit,
} from "../video-export";
import type { ExportSettings, ExportProgress } from "../video-export";
import { exportProject, downloadBlob, safeFilename } from "../files";
import { captionText, srt, audioPlan, categoryBus } from "../production";
import { Modal } from "./Modal";
import { Stage } from "./Stage";
import { CaptionOverlay } from "./CaptionOverlay";
import { AudioDecodeCache } from "../audio-engine";
import type { ExportSegment } from "../segments";
import { SegmentExports } from "./SegmentExports";
import { ReadinessChecklist } from "./ReadinessChecklist";
import { EpisodeReadiness } from "./EpisodeReadiness";
import { FramefieldCaptionVoiceReview } from "./FramefieldCaptionVoiceReview";
import { productionReadiness } from "../readiness";
import type { PublishingMovie, PublishingParts } from "../youtube-kit";
const YouTubeKit = lazy(() => import("./YouTubeKit").then(module => ({ default: module.YouTubeKit })));
const EpisodeDelivery = lazy(() => import("./EpisodeDelivery").then(module => ({ default: module.EpisodeDelivery })));

export function FinishCartoon({
  project,
  onClose,
  onVoices,
  onStoryCards,
  onCaptions,
  onPreview,
  saveStatus,
  onScene,
}: {
  project: Project;
  onClose: () => void;
  onVoices: () => void;
  onStoryCards: () => void;
  onCaptions: () => void;
  onPreview: (sound: boolean) => void;
  saveStatus: string;
  onScene: (index: number, panel?: "voices" | "captions" | "preview" | "camera" | "camera-review" | "camera-pan" | "camera-tilt" | "camera-glide" | "camera-reveal", inspectAt?: number) => void;
}) {
  const [formats] = useState(supportedVideoFormats),
    mobile = window.matchMedia("(max-width:740px)").matches;
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [publishing, setPublishing] = useState<{ open: boolean; joined?: PublishingMovie; parts?: PublishingParts }>();
  const publishingOpen = !!publishing?.open;
  const publishingButton = useRef<HTMLButtonElement>(null);
  const [delivery, setDelivery] = useState<{ limit: number; focus: (segment: ExportSegment, index: number) => void }>();
  const [audioCache] = useState(() => new AudioDecodeCache());
  const [partPreview, setPartPreview] = useState(false);
  const [sceneExportRequest, setSceneExportRequest] = useState<{ sceneIndex: number; serial: number }>();
  const [sourcesReady, setSourcesReady] = useState(
    !project.audioAssets.some((a) => a.file),
  );
  const blocking =
    productionReadiness(project, exportLimit(), !!formats.length).some(
      (i) => i.blocking && !i.id.startsWith("limit:"),
    ) || !sourcesReady;
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
  const [result, setResult] = useState<(PublishingMovie & { url: string; frames: number }) | null>(null),
    controller = useRef<AbortController | null>(null),
    alive = useRef(true),
    total = totalDuration(project),
    active = audioPlan(project, 0, total);
  const expectedAudio = !project.mixer.muted && project.mixer.master > 0 &&
    active.some(({ clip }) => clip.volume > 0 && project.mixer[categoryBus(clip.category)] > 0);
  const canRender = !partPreview && !blocking && !!formats.length && total <= exportLimit();
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
  async function makeVideo(renderSettings = settings) {
    if (running || partPreview) return;
    setRunning(true);
    setResult(null);
    setError("");
    const abort = new AbortController();
    controller.current = abort;
    try {
      const movie = await exportVideo(
        project,
        renderSettings,
        abort.signal,
        (p) => {
          if (alive.current) setProgress(p);
        },
        audioCache,
      );
      if (alive.current)
        setResult({
          video: movie.blob,
          url: URL.createObjectURL(movie.blob),
          frames: movie.frames,
          width: movie.width,
          height: movie.height,
          duration: movie.recordedDuration,
          plan: [{ start: 0, end: movie.duration }],
          ranges: [{ start: 0, end: movie.recordedDuration }],
          burned: renderSettings.captions && project.captions.length > 0,
          expectAudio: renderSettings.audio && expectedAudio,
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
  function closePublishing() {
    setPublishing({ open: false });
    requestAnimationFrame(() => {
      if (deliveryOpen) document.getElementById("prepare-joined-youtube")?.focus();
      else publishingButton.current?.focus();
    });
  }

  return (
    <Modal
      title={publishingOpen ? "Prepare for YouTube" : deliveryOpen ? "Prepare My Complete Episode" : "Finish My Cartoon"}
      onClose={() => {
        controller.current?.abort();
        onClose();
      }}
      wide
    >
      <div hidden={deliveryOpen || publishingOpen}>
      <p className="section-description">
        Review your story, listen once, then make a real WebM movie. Export runs
        on this device and does not record the editor or your screen.
      </p>
      <div className="animation-actions">
        <button ref={publishingButton} className="button primary" disabled={running}
          onClick={() => setPublishing({ open: true })}>Prepare for YouTube</button>
        <button className="button secondary small" disabled={running} onClick={onStoryCards}>{STORY_CARD_STUDIO}</button>
      </div>
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
      <EpisodeReadiness
        project={project}
        onReady={setSourcesReady}
        onScene={onScene}
      />
      {project.templateId === "frame-sequence-storyboard" && (
        <FramefieldCaptionVoiceReview project={project} onScene={onScene}
          onExportScene={(sceneIndex) => setSceneExportRequest(previous => ({
            sceneIndex, serial: (previous?.serial ?? 0) + 1,
          }))} />
      )}
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
              running ||
              partPreview ||
              blocking ||
              !formats.length ||
              total > exportLimit()
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
        {partPreview && (
          <p className="field-hint">
            A segment preview is open below. Download or close it when you are
            finished before exporting a complete movie.
          </p>
        )}
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
            {!publishingOpen && !deliveryOpen && <video
              controls
              playsInline
              src={result.url}
              aria-label="Completed cartoon video"
            />}
            <p className="field-hint">
              Playable WebM · {result.width}×{result.height} ·{" "}
              {(result.video.size / 1024 / 1024).toFixed(2)} MB · {result.frames}{" "}
              scene renders
            </p>
            <button
              className="button primary"
              onClick={() =>
                downloadBlob(result.video, `${safeFilename(project.title)}.webm`)
              }
            >
              Download completed video
            </button>
            <button className="button text" onClick={() => setResult(null)}>
              Close complete movie preview
            </button>
          </div>
        )}
      </section>
      <SegmentExports
        sceneRequest={sceneExportRequest}
        project={project}
        settings={settings}
        cache={audioCache}
        busy={running}
        available={!!formats.length && !blocking && !result}
        onPreview={setPartPreview}
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
        onDelivery={(limit, focus) => {
          setDelivery({ limit, focus });
          setDeliveryOpen(true);
        }}
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
      </div>
      {delivery && <div hidden={!deliveryOpen || publishingOpen}>
        <Suspense fallback={<p role="status">Opening episode delivery…</p>}>
          <EpisodeDelivery project={project} initialLimit={delivery.limit} initialAudio={settings.audio} active={deliveryOpen && !publishingOpen}
            onYouTube={(joined, parts) => setPublishing({ open: true, joined, parts })}
            onBack={() => {
              setDeliveryOpen(false);
              requestAnimationFrame(() => document.getElementById("prepare-episode-delivery")?.focus());
            }}
            onReExport={(segment, index) => {
              setDeliveryOpen(false);
              delivery.focus(segment, index);
            }} />
        </Suspense>
      </div>}
      {publishing && <div hidden={!publishingOpen}>
        <Suspense fallback={<p role="status">Opening publishing tools…</p>}>
          <YouTubeKit project={project} movie={deliveryOpen ? publishing.joined : result ?? undefined}
            parts={publishing.parts} active={publishingOpen}
            expectedAudio={expectedAudio} canRender={canRender} longer={deliveryOpen || total > exportLimit()} busy={running}
            preferredWidth={mobile ? 800 : 1280}
            progress={progress} exportError={error}
            onMake={width => void makeVideo({ ...settings, width, audio: expectedAudio, captions: false })}
            onCancel={() => controller.current?.abort()} onBack={closePublishing}
            onParts={() => {
              closePublishing();
              if (!deliveryOpen) requestAnimationFrame(() => document.getElementById("prepare-episode-delivery")?.click());
            }} />
        </Suspense>
      </div>}
    </Modal>
  );
}
