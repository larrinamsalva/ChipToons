import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { PointerEvent } from "react";
import { clone, uid, validateProject } from "../model";
import type { Project, Scene, SceneElement } from "../model";
import {
  EASINGS,
  EMOTIONS,
  MOUTHS,
  GESTURES,
  MAX_TRACK_KEYS,
} from "../animation-model";
import type {
  AnyKeyframe,
  ElementKeyframe,
  ElementAnimation,
  ElementValues,
  CameraKeyframe,
  BackgroundKeyframe,
} from "../animation-model";
import { POSES } from "../art-model";
import {
  backgroundAt,
  cameraAt,
  clamp,
  elementBase,
  keyAt,
  roundTime,
  snapTime,
} from "../timeline";
import { actionsFor, presetAnimation } from "../presets";
import type { Action } from "../presets";
import { PlaybackClock } from "../playback";
import { elementName, resolvedCharacter } from "../library";
import { Modal } from "./Modal";
import { Stage } from "./Stage";
import { Icon } from "./Icon";

function NumberEntry({
  label,
  value,
  min,
  max,
  step = 0.01,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onCommit: (n: number) => void | boolean;
}) {
  return (
    <label>
      {label}
      <input
        key={value}
        aria-label={label}
        type="number"
        defaultValue={Math.round(value * 1000) / 1000}
        min={min}
        max={max}
        step={step}
        onBlur={(e) => {
          const n = Number(e.target.value);
          if (
            !e.target.value ||
            !Number.isFinite(n) ||
            n < min ||
            n > max ||
            onCommit(n) === false
          )
            e.target.value = String(value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            e.currentTarget.value = String(value);
            e.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}
function LiveTime({
  clock,
  offset,
  duration,
  onSeek,
}: {
  clock: PlaybackClock;
  offset: number;
  duration: number;
  onSeek: (n: number) => void;
}) {
  const snap = useSyncExternalStore(clock.subscribe, clock.getSnapshot);
  const time = clamp(snap.seconds - offset, 0, duration);
  return (
    <div className="timeline-time">
      <output aria-label="Scene current time">
        {time.toFixed(2)}s / {duration}s
      </output>
      <label>
        Go to time
        <input
          aria-label="Scene time (seconds)"
          type="number"
          min="0"
          max={duration}
          step="0.05"
          value={Number(time.toFixed(2))}
          onChange={(e) => {
            if (e.target.value)
              onSeek(clamp(Number(e.target.value), 0, duration));
          }}
        />
      </label>
    </div>
  );
}
function Playhead({
  clock,
  offset,
  duration,
}: {
  clock: PlaybackClock;
  offset: number;
  duration: number;
}) {
  const snap = useSyncExternalStore(clock.subscribe, clock.getSnapshot);
  return (
    <div
      className="track-playhead"
      aria-hidden="true"
      style={{
        left: `${clamp((snap.seconds - offset) / duration, 0, 1) * 100}%`,
      }}
    />
  );
}
function Ruler({
  clock,
  offset,
  duration,
  onSeek,
  snap,
}: {
  clock: PlaybackClock;
  offset: number;
  duration: number;
  onSeek: (n: number) => void;
  snap: number;
}) {
  const state = useSyncExternalStore(clock.subscribe, clock.getSnapshot);
  return (
    <input
      className="ruler-scrubber"
      aria-label="Scene playhead"
      type="range"
      min="0"
      max={duration}
      step={snap || 0.01}
      value={clamp(state.seconds - offset, 0, duration)}
      onChange={(e) => onSeek(Number(e.target.value))}
    />
  );
}
function Marker({
  item,
  duration,
  width,
  snap,
  selected,
  label,
  onSelect,
  onMove,
  onDelete,
}: {
  item: AnyKeyframe;
  duration: number;
  width: number;
  snap: number;
  selected: boolean;
  label: string;
  onSelect: () => void;
  onMove: (time: number) => void;
  onDelete: () => void;
}) {
  const drag = useRef<{ x: number; time: number } | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const suppressClick = useRef(false);
  function move(e: PointerEvent<HTMLButtonElement>, finish = false) {
    if (!drag.current) return;
    const t = snapTime(
      drag.current.time + ((e.clientX - drag.current.x) / width) * duration,
      snap,
      duration,
    );
    if (finish) {
      const changed = Math.abs(t - item.time) > 0.0005;
      suppressClick.current = changed;
      drag.current = null;
      setPreview(null);
      if (changed) onMove(t);
    } else setPreview(t);
  }
  return (
    <button
      type="button"
      className={`key-marker ${selected ? "selected" : ""}`}
      style={{ left: `${((preview ?? item.time) / duration) * 100}%` }}
      aria-label={label}
      aria-pressed={selected}
      title={label}
      onClick={() => {
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        onSelect();
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect();
        drag.current = { x: e.clientX, time: item.time };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => move(e)}
      onPointerUp={(e) => move(e, true)}
      onPointerCancel={() => {
        drag.current = null;
        setPreview(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          onMove(
            snapTime(
              item.time + (e.key === "ArrowLeft" ? -1 : 1) * (snap || 0.05),
              snap,
              duration,
            ),
          );
        }
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          onDelete();
        }
      }}
    >
      <span aria-hidden="true">◆</span>
    </button>
  );
}
function ActionPreview({
  project,
  scene,
  onClose,
}: {
  project: Project;
  scene: Scene;
  onClose: () => void;
}) {
  const [clock] = useState(() => new PlaybackClock());
  const time = useSyncExternalStore(clock.subscribe, clock.getSnapshot);
  useEffect(() => {
    clock.configure(0, scene.duration, true);
    clock.play();
    return () => clock.dispose();
  }, [clock, scene.duration]);
  return (
    <Modal title="Try this action" onClose={onClose} wide>
      <p className="field-hint">
        Preview only. Your saved scene stays as it is until you choose Apply
        action.
      </p>
      <div className="action-preview">
        <Stage project={project} scene={scene} time={time.seconds} />
      </div>
      <div className="animation-actions">
        <button
          className="button primary"
          onClick={() => (time.playing ? clock.pause() : clock.play())}
        >
          {time.playing ? "Pause action preview" : "Play action preview"}
        </button>
        <button className="button secondary" onClick={onClose}>
          Back to timeline
        </button>
      </div>
      <input
        type="range"
        aria-label="Action preview time"
        min="0"
        max={scene.duration}
        step=".05"
        value={time.seconds}
        onChange={(e) => {
          clock.pause();
          clock.seek(Number(e.target.value));
        }}
      />
    </Modal>
  );
}

export function AnimationTimeline({
  project,
  scene,
  clock,
  sceneOffset,
  selectedId,
  onSelect,
  onSeek,
  onChange,
}: {
  project: Project;
  scene: Scene;
  clock: PlaybackClock;
  sceneOffset: number;
  selectedId?: string;
  onSelect: (id: string) => void;
  onSeek: (time: number) => void;
  onChange: (patch: Partial<Scene>) => void;
}) {
  const [choice, setChoice] = useState({
    id: selectedId ?? "camera",
    elementId: selectedId,
  });
  const target =
    choice.elementId === selectedId ? choice.id : (selectedId ?? "camera");
  const [selection, setSelection] = useState("");
  const [zoom, setZoom] = useState(1);
  const [snap, setSnap] = useState(0.1);
  const [message, setMessage] = useState("");
  const [action, setAction] = useState<Action>("walk");
  const [start, setStart] = useState(0);
  const [length, setLength] = useState(Math.min(3, scene.duration));
  const [speed, setSpeed] = useState(1);
  const [cameraMove, setCameraMove] = useState("right");
  const [preview, setPreview] = useState<Scene | null>(null);
  const [help, setHelp] = useState(false);
  const [pending, setPending] = useState<{
    title: string;
    body: string;
    run: () => void;
  } | null>(null);
  const [clipboard, setClipboard] = useState<{
    animation: ElementAnimation;
    base: ElementValues;
    duration: number;
  } | null>(null);
  const element = scene.elements.find((e) => e.id === target);
  const shape =
    !!element &&
    (element.kind === undefined || element.kind === "character") &&
    !element.assetId &&
    !resolvedCharacter(project, element)?.assetId;
  const elementKeys = element?.animation?.keyframes ?? [];
  const keys: AnyKeyframe[] =
    target === "camera"
      ? (scene.cameraAnimation?.keyframes ?? [])
      : target === "background"
        ? (scene.backgroundAnimation?.keyframes ?? [])
        : elementKeys;
  const selected = keys.find((k) => k.id === selection) ?? keys[0];
  const width = Math.max(420, scene.duration * 40 * zoom);
  const atPlayhead = () =>
    snapTime(clock.getSnapshot().seconds - sceneOffset, snap, scene.duration);
  function commit(patch: Partial<Scene>) {
    try {
      validateProject({
        ...project,
        scenes: project.scenes.map((s) =>
          s.id === scene.id ? { ...s, ...patch } : s,
        ),
      });
      onChange(patch);
      setMessage("");
      return true;
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "This edit could not be saved.",
      );
      return false;
    }
  }
  function patchElement(patch: Partial<SceneElement>) {
    if (element)
      return commit({
        elements: scene.elements.map((e) =>
          e.id === element.id ? { ...e, ...patch } : e,
        ),
      });
    return false;
  }
  function setKeys(track: string, newKeys: AnyKeyframe[]) {
    const sorted = [...newKeys].sort((a, b) => a.time - b.time);
    if (
      sorted.some(
        (k, i) => i > 0 && Math.abs(k.time - sorted[i - 1].time) < 0.001,
      )
    ) {
      setMessage(
        "There is already a keyframe at that time. Choose another time.",
      );
      return false;
    }
    if (track === "camera")
      return commit({
        cameraAnimation: {
          ...scene.cameraAnimation,
          keyframes: sorted as CameraKeyframe[],
        },
      });
    if (track === "background")
      return commit({
        backgroundAnimation: {
          enabled: true,
          style: "drift",
          ...scene.backgroundAnimation,
          keyframes: sorted as BackgroundKeyframe[],
        },
      });
    const el = scene.elements.find((e) => e.id === track);
    return (
      !!el &&
      commit({
        elements: scene.elements.map((e) =>
          e.id === track
            ? {
                ...e,
                animation: {
                  blink: true,
                  idle: "none",
                  ...e.animation,
                  keyframes: sorted as ElementKeyframe[],
                },
              }
            : e,
        ),
      })
    );
  }
  function editKey(id: string, patch: Partial<AnyKeyframe>, track = target) {
    const list: AnyKeyframe[] =
      track === "camera"
        ? (scene.cameraAnimation?.keyframes ?? [])
        : track === "background"
          ? (scene.backgroundAnimation?.keyframes ?? [])
          : (scene.elements.find((e) => e.id === track)?.animation?.keyframes ??
            []);
    return setKeys(
      track,
      list.map((k) => (k.id === id ? ({ ...k, ...patch } as AnyKeyframe) : k)),
    );
  }
  function addKey() {
    const time = atPlayhead();
    const old = keys.find((k) => Math.abs(k.time - time) < 0.001);
    if (old) {
      setSelection(old.id);
      setMessage("A keyframe is already here. Edit its values below.");
      return;
    }
    if (keys.length >= MAX_TRACK_KEYS) {
      setMessage(
        "This track has 120 keyframes. Remove one before adding another.",
      );
      return;
    }
    let key: AnyKeyframe;
    if (target === "camera")
      key = {
        ...cameraAt(scene, time),
        id: uid(),
        time,
        easing: "ease-in-out",
      };
    else if (target === "background") {
      const f = backgroundAt(scene, time, true);
      key = {
        x: f.x,
        y: f.y,
        scale: f.scale,
        opacity: f.opacity,
        id: uid(),
        time,
        easing: "ease-in-out",
      };
    } else if (element) key = keyAt(element, time, scene.duration);
    else return;
    if (setKeys(target, [...keys, key])) setSelection(key.id);
  }
  function confirm(
    title: string,
    body: string,
    run: () => void,
    needed = true,
  ) {
    if (needed) setPending({ title, body, run });
    else run();
  }
  function choose(track: string, key?: AnyKeyframe) {
    setChoice({
      id: track,
      elementId: scene.elements.some((e) => e.id === track)
        ? track
        : selectedId,
    });
    setSelection(key?.id ?? "");
    if (scene.elements.some((e) => e.id === track)) onSelect(track);
    if (key) onSeek(key.time);
  }
  function removeKey(track: string, id: string) {
    const list =
      track === "camera"
        ? (scene.cameraAnimation?.keyframes ?? [])
        : track === "background"
          ? (scene.backgroundAnimation?.keyframes ?? [])
          : (scene.elements.find((e) => e.id === track)?.animation?.keyframes ??
            []);
    if (
      setKeys(
        track,
        list.filter((k) => k.id !== id),
      )
    )
      setSelection("");
  }
  function generated() {
    const allowed = actionsFor(shape, element?.prop === "door");
    const chosen = allowed.some(([id]) => id === action)
      ? action
      : allowed[0][0];
    return element
      ? presetAnimation(element, scene.duration, chosen, start, length / speed)
      : undefined;
  }
  function apply() {
    const animation = generated();
    if (!animation) return;
    confirm(
      "Replace this object’s motion?",
      "Applying this action replaces its current keyframes or older motion preset. Camera, other objects and library artwork keep their settings. You can undo the change.",
      () => {
        patchElement({ animation, motion: "still" });
        setSelection(animation.keyframes[0]?.id ?? "");
      },
      !!element?.animation?.keyframes.length || element?.motion !== "still",
    );
  }
  function reset() {
    confirm(
      "Reset this animation?",
      "This removes the selected track’s keyframes and optional motion effects. Artwork, layers and base scene positions stay in place. Undo can restore it.",
      () => {
        if (element) patchElement({ animation: undefined, motion: "still" });
        else if (target === "camera") commit({ cameraAnimation: undefined });
        else commit({ backgroundAnimation: undefined });
        setSelection("");
      },
    );
  }
  function paste() {
    if (!clipboard || !element) return;
    const animation = clone(clipboard.animation),
      base = elementBase(element);
    animation.keyframes = animation.keyframes.map((k) => ({
      ...k,
      id: uid(),
      time: (k.time / clipboard.duration) * scene.duration,
      x: clamp(k.x - clipboard.base.x + base.x, -800, 1600),
      y: clamp(k.y - clipboard.base.y + base.y, -450, 900),
      scale: clamp((k.scale / clipboard.base.scale) * base.scale, 0.05, 4),
      rotation: clamp(
        k.rotation - clipboard.base.rotation + base.rotation,
        -1440,
        1440,
      ),
      ...(!shape
        ? {
            emotion: base.emotion,
            pose: base.pose,
            mouth: "auto" as const,
            gesture: "none" as const,
            heart: "off" as const,
          }
        : {}),
    }));
    confirm(
      "Paste this motion?",
      "The copied path is offset to this object’s base position. This replaces this object’s current motion. Shape-only acting is removed for uploaded pictures and props.",
      () => patchElement({ animation, motion: "still" }),
      !!element.animation?.keyframes.length || element.motion !== "still",
    );
  }
  function cameraPreset() {
    const base = cameraAt({ ...scene, cameraAnimation: undefined }, 0);
    const next = {
      ...base,
      x:
        base.x +
        (cameraMove === "left" ? -100 : cameraMove === "right" ? 100 : 0),
      y: base.y + (cameraMove === "up" ? -60 : cameraMove === "down" ? 60 : 0),
      zoom:
        cameraMove === "in"
          ? Math.min(3, base.zoom * 1.4)
          : cameraMove === "out"
            ? 0.8
            : base.zoom,
    };
    confirm(
      "Replace camera movement?",
      "This replaces camera keyframes. Characters and artwork stay in place.",
      () =>
        commit({
          cameraAnimation: {
            keyframes: [
              { ...base, id: uid(), time: 0, easing: "linear" },
              {
                ...next,
                id: uid(),
                time: scene.duration,
                easing: "ease-in-out",
              },
            ],
          },
        }),
      !!scene.cameraAnimation?.keyframes.length,
    );
  }
  function trackRow(
    id: string,
    name: string,
    list: AnyKeyframe[],
    acting = false,
  ) {
    const visible = acting
      ? (list as ElementKeyframe[]).filter(
          (k, i, a) =>
            !i ||
            ["emotion", "pose", "mouth", "heart", "gesture"].some(
              (field) =>
                k[field as keyof ElementKeyframe] !==
                a[i - 1][field as keyof ElementKeyframe],
            ),
        )
      : list;
    return (
      <div
        className={`timeline-row ${target === id ? "active" : ""} ${acting ? "acting-row" : ""}`}
        key={`${id}-${acting}`}
      >
        <button
          className="track-label"
          aria-label={`Select ${name} track`}
          aria-pressed={target === id}
          onClick={() => choose(id)}
        >
          {acting ? (
            <span aria-hidden="true">☺</span>
          ) : (
            <Icon
              name={
                id === "camera"
                  ? "film"
                  : id === "background"
                    ? "image"
                    : "sparkles"
              }
              size={14}
            />
          )}
          <span>{name}</span>
        </button>
        <div className="track-lane" style={{ width }} data-track={id}>
          <Playhead
            clock={clock}
            offset={sceneOffset}
            duration={scene.duration}
          />
          {visible.map((k) => (
            <Marker
              key={k.id}
              item={k}
              duration={scene.duration}
              width={width}
              snap={snap}
              selected={target === id && selected?.id === k.id}
              label={`${name} keyframe at ${k.time.toFixed(2)} seconds${acting ? `, ${(k as ElementKeyframe).emotion}, ${(k as ElementKeyframe).pose}` : ""}`}
              onSelect={() => choose(id, k)}
              onMove={(time) => {
                if (editKey(k.id, { time }, id)) onSeek(time);
              }}
              onDelete={() => removeKey(id, k.id)}
            />
          ))}
          {!visible.length && (
            <span className="empty-track">
              {id === "background" && !scene.backgroundAnimation?.enabled
                ? "Background motion off"
                : id === "camera"
                  ? "Wide / close camera • add a move"
                  : "Add a keyframe or choose an action"}
            </span>
          )}
        </div>
      </div>
    );
  }
  const available = actionsFor(shape, element?.prop === "door");
  const validAction = available.some(([id]) => id === action)
    ? action
    : available[0][0];
  return (
    <section className="animation-studio" aria-label="Animation timeline">
      <div className="animation-heading">
        <div>
          <span className="eyebrow">ONE LITTLE MOVE AT A TIME</span>
          <h2>Animate your story</h2>
        </div>
        <button
          className="button text small"
          onClick={() => setHelp(!help)}
          aria-expanded={help}
        >
          Show me how
        </button>
      </div>
      {help && (
        <ol className="timeline-help">
          <li>
            Select a character track. Choose an action and try its preview.
          </li>
          <li>
            Apply the action, then move the playhead to a new time. Add a
            keyframe: “Move here.”
          </li>
          <li>
            Change its position, face or pose below. Drag diamonds, use arrow
            keys, or type an exact time.
          </li>
          <li>
            Choose Camera to add a smooth pan. Play the scene, then the complete
            episode. Changes autosave.
          </li>
        </ol>
      )}
      <div className="timeline-toolbar">
        <LiveTime
          clock={clock}
          offset={sceneOffset}
          duration={scene.duration}
          onSeek={onSeek}
        />
        <label>
          Snap
          <select
            aria-label="Timeline snapping"
            value={snap}
            onChange={(e) => setSnap(Number(e.target.value))}
          >
            <option value="0">Off</option>
            <option value="0.1">0.1s</option>
            <option value="0.25">0.25s</option>
            <option value="0.5">0.5s</option>
            <option value="1">1s</option>
          </select>
        </label>
        <label>
          Zoom
          <select
            aria-label="Timeline zoom"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          >
            <option value="0.5">50%</option>
            <option value="1">100%</option>
            <option value="2">200%</option>
          </select>
        </label>
      </div>
      <div
        className="timeline-scroll"
        role="region"
        aria-label="Animation tracks; scroll horizontally to see more time"
        tabIndex={0}
      >
        <div className="timeline-sheet" style={{ width: width + 120 }}>
          <div className="timeline-row ruler-row">
            <span className="track-label">SCENE · {scene.duration}s</span>
            <div className="track-ruler" style={{ width }}>
              {Array.from(
                { length: Math.ceil(scene.duration / (zoom < 1 ? 2 : 1)) + 1 },
                (_, i) => i * (zoom < 1 ? 2 : 1),
              )
                .filter((t) => t <= scene.duration)
                .map((t) => (
                  <span
                    key={t}
                    style={{ left: `${(t / scene.duration) * 100}%` }}
                  >
                    {t}s
                  </span>
                ))}
              <Ruler
                clock={clock}
                offset={sceneOffset}
                duration={scene.duration}
                onSeek={onSeek}
                snap={snap}
              />
            </div>
          </div>
          {trackRow("camera", "Camera", scene.cameraAnimation?.keyframes ?? [])}
          {trackRow(
            "background",
            "Background",
            scene.backgroundAnimation?.keyframes ?? [],
          )}
          {scene.elements.map((e) => (
            <div key={e.id}>
              {trackRow(
                e.id,
                elementName(project, e),
                e.animation?.keyframes ?? [],
              )}
              {(e.kind === undefined || e.kind === "character") &&
                !e.assetId &&
                !resolvedCharacter(project, e)?.assetId &&
                trackRow(
                  e.id,
                  `${elementName(project, e)} · face & pose`,
                  e.animation?.keyframes ?? [],
                  true,
                )}
            </div>
          ))}
        </div>
      </div>
      <div className="keyframe-workspace">
        <div className="keyframe-heading">
          <strong>
            {element
              ? elementName(project, element)
              : target === "camera"
                ? "Camera"
                : "Background"}
          </strong>
          <span>
            {keys.length} / {MAX_TRACK_KEYS} keyframes
          </span>
        </div>
        <div className="animation-actions">
          <button
            className="button primary small"
            onClick={addKey}
            disabled={keys.length >= MAX_TRACK_KEYS}
          >
            <Icon name="plus" size={15} />
            Add keyframe at playhead
          </button>
          <button className="button secondary small" onClick={reset}>
            Reset animation
          </button>
        </div>
        <p className="field-hint">
          {selected
            ? `Move here at ${selected.time.toFixed(2)}s. Change this moment, then move to the next.`
            : "Choose an action, or add a first keyframe to say ‘start moving’. Add another to say ‘stop here’."}
        </p>
        {element && (
          <div className="motion-library">
            <h3>Choose an action</h3>
            <div className="animation-form-grid">
              <label>
                Action
                <select
                  aria-label="Animation action"
                  value={validAction}
                  onChange={(e) => setAction(e.target.value as Action)}
                >
                  {available.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <NumberEntry
                label="Action starts (seconds)"
                value={start}
                min={0}
                max={scene.duration - 0.1}
                onCommit={(n) => setStart(n)}
              />
              <NumberEntry
                label="Action duration (seconds)"
                value={length}
                min={0.1}
                max={scene.duration}
                onCommit={(n) => setLength(n)}
              />
              <label>
                Action speed
                <select
                  aria-label="Action speed"
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                >
                  <option value="0.5">Slow · ½×</option>
                  <option value="1">Normal · 1×</option>
                  <option value="2">Quick · 2×</option>
                </select>
              </label>
            </div>
            <p className="field-hint">
              The action lasts{" "}
              {Math.min(length / speed, scene.duration - start).toFixed(2)}s and
              stops at this scene’s end. Its diamonds remain editable.
            </p>
            <div className="animation-actions">
              <button
                className="button secondary small"
                onClick={() => {
                  const animation = presetAnimation(
                    element,
                    scene.duration,
                    validAction,
                    start,
                    length / speed,
                  );
                  setPreview({
                    ...scene,
                    elements: scene.elements.map((e) =>
                      e.id === element.id
                        ? { ...e, animation, motion: "still" }
                        : e,
                    ),
                  });
                }}
              >
                Preview action
              </button>
              <button className="button primary small" onClick={apply}>
                Apply action
              </button>
              <button
                className="button text small"
                disabled={!element.animation?.keyframes.length}
                onClick={() => {
                  setClipboard({
                    animation: clone(element.animation!),
                    base: elementBase(element),
                    duration: scene.duration,
                  });
                  setMessage(
                    "Motion copied. Select another object and choose Paste motion.",
                  );
                }}
              >
                Copy motion
              </button>
              <button
                className="button text small"
                disabled={!clipboard}
                onClick={paste}
              >
                Paste motion
              </button>
            </div>
            {!shape && (
              <p className="field-hint">
                This artwork moves as a whole object. Face, mouth and limb
                controls are available for original shape characters.
              </p>
            )}
          </div>
        )}
        {target === "camera" && (
          <div className="motion-library">
            <h3>Let the camera tell the story</h3>
            <div className="animation-form-grid">
              <label>
                Camera move
                <select
                  value={cameraMove}
                  onChange={(e) => setCameraMove(e.target.value)}
                >
                  {[
                    ["left", "Pan left"],
                    ["right", "Pan right"],
                    ["up", "Pan up"],
                    ["down", "Pan down"],
                    ["in", "Zoom in"],
                    ["out", "Zoom out"],
                  ].map(([id, name]) => (
                    <option value={id} key={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Follow an object
                <select
                  aria-label="Camera follow"
                  value={scene.cameraAnimation?.followId ?? ""}
                  onChange={(e) =>
                    commit({
                      cameraAnimation: {
                        keyframes: scene.cameraAnimation?.keyframes ?? [],
                        followId: e.target.value || undefined,
                      },
                    })
                  }
                >
                  <option value="">No follow · use positions</option>
                  {scene.elements.map((e) => (
                    <option value={e.id} key={e.id}>
                      {elementName(project, e)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button className="button secondary small" onClick={cameraPreset}>
              Add camera move
            </button>
            <p className="field-hint">
              X/Y are the camera’s center. With follow on, keyframe positions
              are offsets from the followed object. Stage dragging accounts for
              camera zoom and pan.
            </p>
          </div>
        )}
        {target === "background" && (
          <div className="motion-library">
            <label className="inline-check">
              <input
                type="checkbox"
                checked={scene.backgroundAnimation?.enabled ?? false}
                onChange={(e) =>
                  commit({
                    backgroundAnimation: {
                      style: "drift",
                      keyframes: [],
                      ...scene.backgroundAnimation,
                      enabled: e.target.checked,
                    },
                  })
                }
              />
              Enable background motion
            </label>
            <label>
              Background effect
              <select
                value={scene.backgroundAnimation?.style ?? "drift"}
                onChange={(e) =>
                  commit({
                    backgroundAnimation: {
                      enabled: true,
                      keyframes: [],
                      ...scene.backgroundAnimation,
                      style: e.target.value as
                        "drift" | "sway" | "twinkle" | "parallax",
                    },
                  })
                }
              >
                <option value="drift">Drifting clouds</option>
                <option value="sway">Gentle sway</option>
                <option value="twinkle">Soft stars</option>
                <option value="parallax">Background parallax</option>
              </select>
            </label>
            <button
              className="button secondary small"
              onClick={() =>
                confirm(
                  "Replace background keyframes?",
                  "This creates a gentle background move. You can edit both endpoints or turn motion off.",
                  () =>
                    commit({
                      backgroundAnimation: {
                        enabled: true,
                        style: scene.backgroundAnimation?.style ?? "parallax",
                        keyframes: [
                          {
                            id: uid(),
                            time: 0,
                            easing: "linear",
                            x: -16,
                            y: 0,
                            scale: 1.08,
                            opacity: 1,
                          },
                          {
                            id: uid(),
                            time: scene.duration,
                            easing: "ease-in-out",
                            x: 16,
                            y: 0,
                            scale: 1.08,
                            opacity: 1,
                          },
                        ],
                      },
                    }),
                  !!scene.backgroundAnimation?.keyframes.length,
                )
              }
            >
              Add gentle background motion
            </button>
            <p className="field-hint">
              Clouds and stars appear in outdoor original settings. Keyframes
              move the original background layer. Uploaded backdrops have their
              own object tracks.
            </p>
          </div>
        )}
        {!!keys.length && (
          <label>
            Choose a keyframe
            <select
              aria-label="Choose keyframe"
              value={selected?.id ?? ""}
              onChange={(e) => {
                const k = keys.find((k) => k.id === e.target.value);
                if (k) {
                  setSelection(k.id);
                  onSeek(k.time);
                }
              }}
            >
              {keys.map((k, i) => (
                <option key={k.id} value={k.id}>
                  Moment {i + 1} · {k.time.toFixed(2)}s
                </option>
              ))}
            </select>
          </label>
        )}
        {selected && (
          <div
            className="keyframe-inspector"
            aria-label="Selected keyframe properties"
          >
            <h3>Selected moment</h3>
            <div className="animation-form-grid">
              <NumberEntry
                label="Keyframe time (seconds)"
                value={selected.time}
                min={0}
                max={scene.duration}
                onCommit={(n) => {
                  const ok = editKey(selected.id, { time: roundTime(n) });
                  if (ok) onSeek(n);
                  return ok;
                }}
              />
              <label>
                Arrive with
                <select
                  aria-label="Keyframe easing"
                  value={selected.easing}
                  onChange={(e) =>
                    editKey(selected.id, {
                      easing: e.target.value as AnyKeyframe["easing"],
                    })
                  }
                >
                  {EASINGS.map((e) => (
                    <option key={e}>{e}</option>
                  ))}
                </select>
              </label>
              <NumberEntry
                label="Keyframe X"
                value={selected.x}
                min={target === "background" ? -200 : -800}
                max={target === "background" ? 200 : 1600}
                onCommit={(n) => editKey(selected.id, { x: n })}
              />
              <NumberEntry
                label="Keyframe Y"
                value={selected.y}
                min={target === "background" ? -120 : -450}
                max={target === "background" ? 120 : 900}
                onCommit={(n) => editKey(selected.id, { y: n })}
              />
              {target === "camera" ? (
                <NumberEntry
                  label="Camera zoom"
                  value={(selected as CameraKeyframe).zoom}
                  min={0.5}
                  max={3}
                  onCommit={(n) => editKey(selected.id, { zoom: n })}
                />
              ) : (
                <>
                  <NumberEntry
                    label="Keyframe scale"
                    value={(selected as ElementKeyframe).scale}
                    min={target === "background" ? 1 : 0.05}
                    max={target === "background" ? 1.5 : 4}
                    onCommit={(n) => editKey(selected.id, { scale: n })}
                  />
                  <NumberEntry
                    label="Keyframe opacity"
                    value={(selected as ElementKeyframe).opacity}
                    min={0}
                    max={1}
                    onCommit={(n) => editKey(selected.id, { opacity: n })}
                  />
                </>
              )}
              {element && (
                <NumberEntry
                  label="Keyframe rotation"
                  value={(selected as ElementKeyframe).rotation}
                  min={-1440}
                  max={1440}
                  onCommit={(n) => editKey(selected.id, { rotation: n })}
                />
              )}
              {shape && (
                <>
                  <label>
                    Expression
                    <select
                      aria-label="Keyframe expression"
                      value={(selected as ElementKeyframe).emotion}
                      onChange={(e) =>
                        editKey(selected.id, {
                          emotion: e.target.value as ElementKeyframe["emotion"],
                        })
                      }
                    >
                      {EMOTIONS.map((e) => (
                        <option key={e}>{e}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Pose
                    <select
                      aria-label="Keyframe pose"
                      value={(selected as ElementKeyframe).pose}
                      onChange={(e) =>
                        editKey(selected.id, {
                          pose: e.target.value as ElementKeyframe["pose"],
                        })
                      }
                    >
                      {POSES.map((e) => (
                        <option key={e}>{e}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Mouth
                    <select
                      aria-label="Keyframe mouth"
                      value={(selected as ElementKeyframe).mouth}
                      onChange={(e) =>
                        editKey(selected.id, {
                          mouth: e.target.value as ElementKeyframe["mouth"],
                        })
                      }
                    >
                      {MOUTHS.map((e) => (
                        <option key={e}>
                          {e === "auto"
                            ? "Follow expression"
                            : e === "talking"
                              ? "Talking cycle (silent)"
                              : e}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Part motion
                    <select
                      aria-label="Keyframe gesture"
                      value={(selected as ElementKeyframe).gesture}
                      onChange={(e) =>
                        editKey(selected.id, {
                          gesture: e.target.value as ElementKeyframe["gesture"],
                        })
                      }
                    >
                      {GESTURES.map((e) => (
                        <option key={e}>{e}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Heart glow
                    <select
                      aria-label="Keyframe heart effect"
                      value={(selected as ElementKeyframe).heart}
                      onChange={(e) =>
                        editKey(selected.id, {
                          heart: e.target.value as ElementKeyframe["heart"],
                        })
                      }
                    >
                      {[
                        ["off", "Off"],
                        ["warm", "Happy · warm halo"],
                        ["helping", "Helping · soft pulse & rays"],
                        ["sad", "Sad · dim halo"],
                        ["calm", "Reassurance · steady halo"],
                        ["together", "Cooperate · growing twin hearts"],
                      ].map(([id, name]) => (
                        <option value={id} key={id}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <NumberEntry
                    label="Heart glow strength"
                    value={(selected as ElementKeyframe).heartStrength}
                    min={0}
                    max={1}
                    onCommit={(n) => editKey(selected.id, { heartStrength: n })}
                  />
                </>
              )}
              {element?.prop === "door" && (
                <NumberEntry
                  label="Door opening"
                  value={(selected as ElementKeyframe).openness}
                  min={0}
                  max={1}
                  onCommit={(n) => editKey(selected.id, { openness: n })}
                />
              )}
            </div>
            <div className="animation-actions">
              <button
                className="button secondary small"
                disabled={keys.length >= MAX_TRACK_KEYS}
                onClick={() => {
                  let time = snapTime(
                    selected.time + (snap || 0.1),
                    0,
                    scene.duration,
                  );
                  while (
                    keys.some((k) => Math.abs(k.time - time) < 0.001) &&
                    time < scene.duration
                  )
                    time = roundTime(time + (snap || 0.1));
                  if (keys.some((k) => Math.abs(k.time - time) < 0.001)) {
                    setMessage(
                      "Move the playhead to an empty time, then add a keyframe.",
                    );
                    return;
                  }
                  const copy = { ...clone(selected), id: uid(), time };
                  if (setKeys(target, [...keys, copy])) {
                    setSelection(copy.id);
                    onSeek(time);
                  }
                }}
              >
                Duplicate keyframe
              </button>
              <button
                className="button text small"
                onClick={() => removeKey(target, selected.id)}
              >
                Delete keyframe
              </button>
            </div>
          </div>
        )}
        {element && (
          <div className="animation-idle">
            <label className="inline-check">
              <input
                type="checkbox"
                checked={element.animation?.blink ?? true}
                disabled={!shape}
                onChange={(e) =>
                  patchElement({
                    animation: {
                      keyframes: [],
                      idle: "none",
                      ...element.animation,
                      blink: e.target.checked,
                    },
                  })
                }
              />
              Natural blinking
            </label>
            <label>
              Idle motion
              <select
                aria-label="Idle motion"
                value={element.animation?.idle ?? "none"}
                onChange={(e) =>
                  patchElement({
                    animation: {
                      keyframes: [],
                      blink: true,
                      ...element.animation,
                      idle: e.target.value as "none" | "breathe" | "float",
                    },
                  })
                }
              >
                <option value="none">None</option>
                <option value="breathe">Tiny breathing</option>
                <option value="float">Small float</option>
              </select>
            </label>
          </div>
        )}
      </div>
      {message && (
        <p className="animation-message" role="status">
          {message}
        </p>
      )}
      {preview && (
        <ActionPreview
          project={project}
          scene={preview}
          onClose={() => setPreview(null)}
        />
      )}
      {pending && (
        <Modal title={pending.title} onClose={() => setPending(null)}>
          <p>{pending.body}</p>
          <div className="animation-actions">
            <button
              className="button secondary"
              onClick={() => setPending(null)}
            >
              Cancel
            </button>
            <button
              className="button primary"
              onClick={() => {
                pending.run();
                setPending(null);
              }}
            >
              Replace animation
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
