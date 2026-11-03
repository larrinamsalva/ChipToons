import { CaptionOverlay } from "./CaptionOverlay";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import type { Project } from "../model";
import { durationLabel, totalDuration } from "../model";
import { frameAt, sceneStart, clamp } from "../timeline";
import type { PlaybackClock } from "../playback";
import { Stage } from "./Stage";
import { Icon } from "./Icon";

export function ScenePlayer({
  project,
  index,
  clock,
  selectedId,
  onSelect,
  onMove,
  onResize,
  onPlaying,
  onIndex,
  onSeek,
  onSceneSelect,
  onPlay,
  scope,
  onScope,
  loop,
  onLoop,
  children,
  sound,
  onSound,
  audioBusy,
}: {
  project: Project;
  index: number;
  clock: PlaybackClock;
  selectedId?: string;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onResize: (id: string, scale: number) => void;
  onPlaying: (value: boolean) => void;
  onIndex: (index: number) => void;
  onSeek: (seconds: number) => void;
  onSceneSelect: (index: number) => void;
  onPlay: () => void;
  scope: "episode" | "scene";
  onScope: (value: "episode" | "scene") => void;
  loop: boolean;
  onLoop: (value: boolean) => void;
  children: ReactNode;
  sound: boolean;
  onSound: (value: boolean) => void;
  audioBusy: boolean;
}) {
  const snapshot = useSyncExternalStore(clock.subscribe, clock.getSnapshot);
  const [captions, setCaptions] = useState(true);
  const [calm, setCalm] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const frame = frameAt(project, snapshot.seconds);
  const shown = snapshot.playing && scope === "episode" ? frame.index : index;
  const scene = project.scenes[shown];
  const localTime = clamp(
    snapshot.seconds - sceneStart(project, shown),
    0,
    scene.duration,
  );
  const total = totalDuration(project);
  useEffect(() => {
    onPlaying(snapshot.playing);
  }, [snapshot.playing, onPlaying]);
  useEffect(() => {
    if (snapshot.playing && shown !== index) onIndex(shown);
  }, [snapshot.playing, shown, index, onIndex]);
  return (
    <section className="stage-panel" aria-label="Cartoon preview">
      <div className="stage-header">
        <span>
          <Icon name="film" size={16} />
          SCENE {shown + 1} OF {project.scenes.length}
        </span>
        <span className="preview-badge">
          {snapshot.playing ? "Playing your story" : "Live scene preview"}
        </span>
      </div>
      <div className="live-stage">
        <Stage
          project={project}
          scene={scene}
          time={localTime}
          calmPreview={calm}
          selectedId={selectedId}
          onSelect={snapshot.playing ? undefined : onSelect}
          onMove={snapshot.playing ? undefined : onMove}
          onResize={snapshot.playing ? undefined : onResize}
        />
        {captions && (
          <CaptionOverlay
            text={project.captions
              .filter(
                (c) =>
                  c.sceneId === scene.id &&
                  localTime >= c.start &&
                  localTime < c.end,
              )
              .map((c) => c.text)
              .join(" ")}
            style={project.captionStyle}
          />
        )}
        <div className="stage-scene-label">{scene.title}</div>
      </div>
      {captions && (
        <div className="caption-box" aria-live="off">
          <span>NARRATION</span>
          <p>
            {scene.narration || "Add a little narration to tell your story."}
          </p>
          {scene.dialogue && (
            <p className="dialogue-caption">{scene.dialogue}</p>
          )}
        </div>
      )}
      <div className="playback">
        <div className="transport">
          <button
            className="icon-button"
            aria-label="Restart cartoon"
            onClick={() =>
              onSeek(scope === "scene" ? sceneStart(project, index) : 0)
            }
          >
            <Icon name="restart" size={19} />
          </button>
          <button
            className="icon-button"
            aria-label="Previous scene"
            disabled={shown === 0}
            onClick={() => onSceneSelect(shown - 1)}
          >
            <Icon name="previous" size={19} />
          </button>
          <button
            className="play-button"
            aria-label={snapshot.playing ? "Pause cartoon" : "Play cartoon"}
            onClick={onPlay}
            disabled={audioBusy}
          >
            <Icon name={snapshot.playing ? "pause" : "play"} size={21} />
          </button>
          <button
            className="icon-button"
            aria-label="Next scene"
            disabled={shown === project.scenes.length - 1}
            onClick={() => onSceneSelect(shown + 1)}
          >
            <Icon name="next" size={19} />
          </button>
          <span className="time-display">
            {durationLabel(Math.min(snapshot.seconds, total))}
            <span> / {durationLabel(total)}</span>
          </span>
        </div>
        <label className="caption-toggle">
          <input
            type="checkbox"
            checked={sound}
            onChange={(e) => onSound(e.target.checked)}
          />
          Sound
        </label>
        <label className="caption-toggle">
          <input
            type="checkbox"
            checked={captions}
            onChange={(e) => setCaptions(e.target.checked)}
          />
          Captions
        </label>
      </div>
      <input
        className="episode-scrubber"
        aria-label="Cartoon play position"
        type="range"
        min="0"
        max={total}
        step="0.05"
        value={Math.min(snapshot.seconds, total)}
        onChange={(e) => onSeek(Number(e.target.value))}
      />
      <div className="preview-options">
        <label>
          Preview scope
          <select
            aria-label="Preview scope"
            value={scope}
            onChange={(e) => onScope(e.target.value as "episode" | "scene")}
          >
            <option value="episode">Complete episode</option>
            <option value="scene">Selected scene</option>
          </select>
        </label>
        <label className="inline-check">
          <input
            type="checkbox"
            checked={loop}
            disabled={scope !== "scene"}
            onChange={(e) => onLoop(e.target.checked)}
          />
          Loop scene
        </label>
        <label className="inline-check">
          <input
            type="checkbox"
            checked={calm}
            onChange={(e) => setCalm(e.target.checked)}
          />
          Calmer preview
        </label>
      </div>
      {calm && (
        <p className="field-hint">
          Idle motion, blinking, glow pulses and background effects are still in
          this preview. Authored keyframes play normally. Your saved cartoon is
          unchanged.
        </p>
      )}
      {children}
      <div className="timeline-strip" aria-label="Scene timeline">
        {project.scenes
          .slice(Math.floor(shown / 12) * 12, Math.floor(shown / 12) * 12 + 12)
          .map((s, n) => {
            const i = Math.floor(shown / 12) * 12 + n;
            return (
              <button
                key={s.id}
                style={{ flex: s.duration }}
                className={shown === i ? "active" : ""}
                aria-label={`Go to scene ${i + 1}: ${s.title}`}
                onClick={() => onSceneSelect(i)}
              >
                <span>{i + 1}</span>
                <small>{s.duration}s</small>
              </button>
            );
          })}
      </div>
      {project.scenes.length > 12 && (
        <label className="scene-jump">
          Jump to any scene
          <select
            aria-label="Jump to any scene"
            value={shown}
            onChange={(e) => onSceneSelect(Number(e.target.value))}
          >
            {project.scenes.map((s, i) => (
              <option key={s.id} value={i}>
                {i + 1}. {s.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="preview-note">
        <Icon name="bulb" size={16} />
        {audioBusy
          ? "Preparing local audio…"
          : sound
            ? "Sound uses recorded or uploaded clips and your cartoon mixer."
            : "Sound is off for this preview. Saved audio is unchanged."}
      </p>
    </section>
  );
}
