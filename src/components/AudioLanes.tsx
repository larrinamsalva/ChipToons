import { useRef, useState, useSyncExternalStore } from "react";
import type { PointerEvent } from "react";
import type { Project, Scene } from "../model";
import { totalDuration } from "../model";
import { CATEGORIES } from "../media-model";
import type { AudioClip, AudioCategory } from "../media-model";
import { clipStart } from "../production";
import { clamp, snapTime } from "../timeline";
import type { PlaybackClock } from "../playback";
import { Icon } from "./Icon";
function AudioPlayhead({
  clock,
  offset,
  duration,
}: {
  clock: PlaybackClock;
  offset: number;
  duration: number;
}) {
  const s = useSyncExternalStore(clock.subscribe, clock.getSnapshot);
  return (
    <div
      className="track-playhead"
      aria-hidden="true"
      style={{ left: `${clamp((s.seconds - offset) / duration, 0, 1) * 100}%` }}
    />
  );
}
function ClipBlock({
  clip,
  project,
  scene,
  offset,
  width,
  snap,
  onEdit,
  onMove,
}: {
  clip: AudioClip;
  project: Project;
  scene: Scene;
  offset: number;
  width: number;
  snap: number;
  onEdit: () => void;
  onMove: (start: number) => void;
}) {
  const drag = useRef<{ x: number; start: number } | null>(null),
    suppress = useRef(false);
  const [shift, setShift] = useState(0),
    absolute = clipStart(project, clip) + shift,
    start = clamp(absolute - offset, 0, scene.duration),
    end = clamp(absolute + clip.duration - offset, 0, scene.duration);
  const limit = clip.sceneId
    ? project.scenes.find((s) => s.id === clip.sceneId)!.duration
    : totalDuration(project);
  function move(e: PointerEvent<HTMLButtonElement>, finish = false) {
    if (!drag.current) return;
    const time = snapTime(
      drag.current.start +
        ((e.clientX - drag.current.x) / width) * scene.duration,
      snap,
      Math.max(0, limit - clip.duration),
    );
    if (finish) {
      suppress.current = Math.abs(time - clip.start) > 0.001;
      drag.current = null;
      setShift(0);
      if (suppress.current) onMove(time);
    } else setShift(time - clip.start);
  }
  return (
    <button
      className={`audio-clip-block ${clip.category} ${clip.muted ? "muted" : ""}`}
      style={{
        left: `${(start / scene.duration) * 100}%`,
        width: `${Math.max(1, ((end - start) / scene.duration) * 100)}%`,
      }}
      aria-label={`Edit ${clip.category} clip ${clip.name}`}
      title={`${clip.name} · ${clip.duration.toFixed(2)}s${clip.muted ? " · muted" : ""}`}
      onClick={() => {
        if (suppress.current) {
          suppress.current = false;
          return;
        }
        onEdit();
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, start: clip.start };
      }}
      onPointerMove={(e) => move(e)}
      onPointerUp={(e) => move(e, true)}
      onPointerCancel={() => {
        drag.current = null;
        setShift(0);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          onMove(
            snapTime(
              clip.start + (e.key === "ArrowLeft" ? -1 : 1) * (snap || 0.05),
              snap,
              Math.max(0, limit - clip.duration),
            ),
          );
        }
      }}
    >
      <span>
        {clip.muted ? "◇" : "♪"} {clip.name}
      </span>
    </button>
  );
}
export function AudioLanes({
  project,
  scene,
  clock,
  offset,
  width,
  snap,
  onEdit,
  onMove,
}: {
  project: Project;
  scene: Scene;
  clock: PlaybackClock;
  offset: number;
  width: number;
  snap: number;
  onEdit: (id?: string, category?: AudioCategory) => void;
  onMove: (id: string, start: number) => void;
}) {
  return (
    <>
      {CATEGORIES.map((category) => (
        <div className="timeline-row" key={category}>
          <button
            className="track-label"
            aria-label={`Open ${category} audio track`}
            onClick={() => onEdit(undefined, category)}
          >
            <Icon name="play" size={14} />
            <span>
              {category === "effects"
                ? "Sound effects"
                : category[0].toUpperCase() + category.slice(1)}
            </span>
          </button>
          <div className="track-lane" style={{ width }}>
            <AudioPlayhead
              clock={clock}
              offset={offset}
              duration={scene.duration}
            />
            {project.audioClips
              .filter(
                (c) =>
                  c.category === category &&
                  clipStart(project, c) < offset + scene.duration &&
                  clipStart(project, c) + c.duration > offset,
              )
              .map((c) => (
                <ClipBlock
                  key={c.id}
                  clip={c}
                  project={project}
                  scene={scene}
                  offset={offset}
                  width={width}
                  snap={snap}
                  onEdit={() => onEdit(c.id, category)}
                  onMove={(start) => onMove(c.id, start)}
                />
              ))}
          </div>
        </div>
      ))}
    </>
  );
}
