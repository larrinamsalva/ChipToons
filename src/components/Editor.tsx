import { useEffect, useState } from "react";
import {
  makeScene,
  totalDuration,
  uid,
  durationLabel,
  validateProject,
} from "../model";
import type { Character, Project, Scene, SceneElement } from "../model";
import {
  frameAt,
  sceneStart,
  elementAt,
  clamp,
  putElementKey,
  duplicateAnimatedScene,
  cleanSceneReferences,
  retimeScene,
} from "../timeline";
import { PlaybackClock } from "../playback";
import { ScenePlayer } from "./ScenePlayer";
import { AnimationTimeline } from "./AnimationTimeline";
import {
  downloadBlob,
  exportProject,
  safeFilename,
  storyboardSvg,
} from "../files";
import { Icon } from "./Icon";
import { Stage } from "./Stage";
import { CompositionTools } from "./CompositionTools";
import { resolvedCharacter, libraryItemFromElement } from "../library";
import type { LibraryItem } from "../library";
import { POSES } from "../art-model";
import type { Pose } from "../art-model";

export function Editor({
  project,
  onChange,
  onBack,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  saveStatus,
  onRetry,
  onLibrary,
}: {
  project: Project;
  onChange: (p: Project) => void;
  onBack: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  saveStatus: string;
  onRetry: () => void;
  onLibrary: (sceneIndex: number, draft?: LibraryItem) => void;
}) {
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [clock] = useState(() => new PlaybackClock());
  const [scope, setScope] = useState<"episode" | "scene">("episode");
  const [loop, setLoop] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSeconds, setEditSeconds] = useState(0);
  const [panel, setPanel] = useState("scene");
  const [mobilePanel, setMobilePanel] = useState("stage");
  const [elementIndex, setElementIndex] = useState(0);

  const total = totalDuration(project);
  const index = Math.min(selected, project.scenes.length - 1);
  const scene = project.scenes[index];
  const displayedIndex = index;
  const element =
    scene.elements[
      Math.max(0, Math.min(elementIndex, scene.elements.length - 1))
    ];
  const displayedElement = element?.animation?.keyframes.length
    ? elementAt(
        element,
        clamp(editSeconds - sceneStart(project, index), 0, scene.duration),
        scene.duration,
        true,
      )
    : element;
  const character = resolvedCharacter(project, element);
  useEffect(() => () => clock.dispose(), [clock]);
  function seek(value: number) {
    clock.pause();
    clock.configure(0, total, false);
    const t = clamp(value, 0, total);
    clock.seek(t);
    setEditSeconds(t);
    setSelected(frameAt(project, t).index);
    clock.pause();
    setPlaying(false);
  }
  function seekLocal(value: number) {
    clock.pause();
    clock.configure(0, total, false);
    clock.seek(sceneStart(project, index) + clamp(value, 0, scene.duration));
    setEditSeconds(clock.getSnapshot().seconds);
    clock.pause();
    setPlaying(false);
  }
  function selectScene(next: number) {
    const i = clamp(next, 0, project.scenes.length - 1);
    seek(sceneStart(project, i));
    setSelected(i);
    setElementIndex(0);
  }
  function play() {
    if (clock.getSnapshot().playing) {
      const t = clock.getSnapshot().seconds;
      setEditSeconds(t);
      clock.pause();
      setPlaying(false);
      if (scope === "episode") setSelected(frameAt(project, t).index);
      return;
    }
    const start = scope === "scene" ? sceneStart(project, index) : 0;
    const end = scope === "scene" ? start + scene.duration : total;
    clock.configure(start, end, scope === "scene" && loop);
    clock.play();
    setPlaying(true);
    setMobilePanel("stage");
  }
  function changeScene(patch: Partial<Scene>) {
    setEditSeconds(clock.getSnapshot().seconds);
    clock.pause();
    setPlaying(false);
    let next = { ...scene, ...patch };
    if (patch.duration !== undefined && patch.duration !== scene.duration)
      next = retimeScene(scene, patch.duration);
    next = cleanSceneReferences(next);
    const updated = {
      ...project,
      scenes: project.scenes.map((s, i) => (i === index ? next : s)),
    };
    try {
      validateProject(updated);
      onChange(updated);
      setEditError("");
    } catch (e) {
      setEditError(
        e instanceof Error ? e.message : "This edit could not be saved.",
      );
      return;
    }
    if (patch.duration !== undefined) {
      const local = clamp(
        clock.getSnapshot().seconds - sceneStart(project, index),
        0,
        patch.duration,
      );
      clock.configure(0, totalDuration(updated), false);
      clock.seek(sceneStart(updated, index) + local);
    }
  }
  function updateElement(id: string, patch: Partial<SceneElement>) {
    const source = scene.elements.find((e) => e.id === id);
    const time = clamp(
      clock.getSnapshot().seconds - sceneStart(project, index),
      0,
      scene.duration,
    );
    if (
      Object.keys(patch).some((k) =>
        ["x", "y", "scale", "rotation", "opacity", "emotion", "pose"].includes(
          k,
        ),
      ) &&
      source?.animation &&
      source.animation.keyframes.length >= 120 &&
      !source.animation.keyframes.some((k) => Math.abs(k.time - time) < 0.001)
    ) {
      setEditError(
        "This track has 120 keyframes. Edit an existing moment or remove one first.",
      );
      return;
    }
    changeScene({
      elements: scene.elements.map((e) => {
        if (e.id !== id) return e;
        const animated =
          e.animation?.keyframes.length &&
          Object.keys(patch).some((k) =>
            [
              "x",
              "y",
              "scale",
              "rotation",
              "opacity",
              "emotion",
              "pose",
            ].includes(k),
          );
        if (!animated) return { ...e, ...patch };
        const { x, y, scale, rotation, opacity, emotion, pose, ...rest } =
          patch;
        const values = Object.fromEntries(
          Object.entries({
            x,
            y,
            scale,
            rotation,
            opacity,
            emotion,
            pose,
          }).filter(([, v]) => v !== undefined),
        );
        return {
          ...e,
          ...rest,
          animation: putElementKey(
            e,
            clamp(
              clock.getSnapshot().seconds - sceneStart(project, index),
              0,
              scene.duration,
            ),
            scene.duration,
            values,
          ),
        };
      }),
    });
  }
  function changeElement(patch: Partial<SceneElement>) {
    if (element) updateElement(element.id, patch);
  }
  function changeCharacter(patch: Partial<Character>) {
    if (!element || !character) return;
    const { name, ...appearance } = patch;
    changeElement({
      ...(name !== undefined ? { name } : {}),
      appearance: { ...element.appearance, ...appearance },
    });
  }
  function addScene() {
    if (project.scenes.length >= 120) return;
    const scenes = [...project.scenes];
    scenes.splice(index + 1, 0, makeScene(project.characters, scenes.length));
    try {
      validateProject({ ...project, scenes });
    } catch {
      setEditError(
        "This scene would exceed the project animation or artwork limits. Your project is unchanged.",
      );
      return;
    }
    onChange({ ...project, scenes });
    setSelected(index + 1);
    clock.pause();
    clock.configure(
      0,
      scenes.reduce((n, s) => n + s.duration, 0),
      false,
    );
    clock.seek(scenes.slice(0, index + 1).reduce((n, s) => n + s.duration, 0));
    setPlaying(false);
  }
  function duplicateScene() {
    if (project.scenes.length >= 120) return;
    const copy = duplicateAnimatedScene(scene);
    copy.title = `${copy.title.slice(0, 150)} (copy)`;
    const scenes = [...project.scenes];
    scenes.splice(index + 1, 0, copy);
    try {
      validateProject({ ...project, scenes });
    } catch {
      setEditError(
        "This scene would exceed the project animation or artwork limits. Your project is unchanged.",
      );
      return;
    }
    onChange({ ...project, scenes });
    setSelected(index + 1);
    clock.pause();
    clock.configure(
      0,
      scenes.reduce((n, s) => n + s.duration, 0),
      false,
    );
    clock.seek(scenes.slice(0, index + 1).reduce((n, s) => n + s.duration, 0));
    setPlaying(false);
  }
  function moveScene(direction: number) {
    const next = index + direction;
    if (next < 0 || next >= project.scenes.length) return;
    const scenes = [...project.scenes];
    [scenes[index], scenes[next]] = [scenes[next], scenes[index]];
    try {
      validateProject({ ...project, scenes });
    } catch {
      setEditError(
        "This scene would exceed the project animation or artwork limits. Your project is unchanged.",
      );
      return;
    }
    onChange({ ...project, scenes });
    setSelected(next);
    clock.pause();
    clock.configure(0, total, false);
    clock.seek(scenes.slice(0, next).reduce((n, s) => n + s.duration, 0));
    setPlaying(false);
  }
  function removeScene() {
    if (project.scenes.length < 2) return;
    onChange({
      ...project,
      scenes: project.scenes.filter((_, i) => i !== index),
    });
    const remaining = project.scenes.filter((_, i) => i !== index),
      next = Math.max(0, index - 1);
    setSelected(next);
    clock.pause();
    clock.configure(
      0,
      remaining.reduce((n, s) => n + s.duration, 0),
      false,
    );
    clock.seek(remaining.slice(0, next).reduce((n, s) => n + s.duration, 0));
    setPlaying(false);
  }
  function toggleCharacter(c: Character) {
    const existing = scene.elements.find((e) => e.characterId === c.id);
    changeScene({
      elements: existing
        ? scene.elements.filter((e) => e.characterId !== c.id)
        : [
            ...scene.elements,
            {
              id: uid(),
              characterId: c.id,
              x: 400,
              y: 340,
              scale: 1,
              rotation: 0,
              flip: false,
              emotion: "happy",
              motion: "still",
            },
          ],
    });
    setElementIndex(0);
  }
  return (
    <main className="editor" id="main-content">
      <div className="editor-top">
        <div className="editor-title-row">
          <button
            className="icon-button back-home"
            aria-label="Save and return to my cartoons"
            onClick={onBack}
          >
            <Icon name="back" />
          </button>
          <div>
            <span className="eyebrow">MY CARTOONS / STORY STUDIO</span>
            <h1>{project.title}</h1>
          </div>
        </div>
        <div className="editor-top-actions">
          <span
            className={`save-status ${saveStatus === "Save failed" ? "failed" : ""}`}
            role="status"
          >
            <Icon
              name={saveStatus === "Saved on this device" ? "check" : "cloud"}
              size={16}
            />
            {saveStatus}
          </span>
          {saveStatus === "Save failed" && (
            <button className="button text small" onClick={onRetry}>
              Retry save
            </button>
          )}
          <button
            className="button secondary small"
            onClick={() => exportProject(project)}
          >
            <Icon name="download" size={17} />
            Project backup
          </button>
        </div>
      </div>
      <div className="editor-toolbar">
        <div className="studio-label">
          <span className="studio-dot" />
          Let’s bring your story to life.
        </div>
        <div className="toolbar-actions">
          <button
            className="button secondary small"
            onClick={() => {
              clock.pause();
              setPlaying(false);
              onLibrary(index);
            }}
          >
            <Icon name="folder" size={17} />
            Art library
          </button>
          <button
            className="icon-button"
            aria-label="Undo edit"
            disabled={!canUndo}
            onClick={() => {
              clock.pause();
              setPlaying(false);
              onUndo();
            }}
          >
            <Icon name="undo" size={18} />
          </button>
          <button
            className="icon-button"
            aria-label="Redo edit"
            disabled={!canRedo}
            onClick={() => {
              clock.pause();
              setPlaying(false);
              onRedo();
            }}
          >
            <Icon name="redo" size={18} />
          </button>
          <span className="toolbar-divider" />
          <button
            className="button text small"
            onClick={() =>
              downloadBlob(
                new Blob([storyboardSvg(project)], { type: "image/svg+xml" }),
                `${safeFilename(project.title)}-storyboard.svg`,
              )
            }
          >
            <Icon name="book" size={17} />
            Download storyboard
          </button>
        </div>
      </div>
      <nav className="mobile-editor-tabs" aria-label="Editor panels">
        {[
          ["scenes", "film", "Scenes"],
          ["stage", "play", "Preview"],
          ["properties", "settings", "Edit scene"],
        ].map(([id, icon, name]) => (
          <button
            className={mobilePanel === id ? "active" : ""}
            aria-pressed={mobilePanel === id}
            key={id}
            onClick={() => setMobilePanel(id)}
          >
            <Icon name={icon} size={17} />
            {name}
          </button>
        ))}
      </nav>
      {editError && (
        <p className="animation-message" role="alert">
          {editError}
        </p>
      )}
      <div className={`editor-workspace mobile-show-${mobilePanel}`}>
        <aside className="scene-panel" aria-label="Storyboard scenes">
          <div className="panel-heading">
            <h2>Your storyboard</h2>
            <span className="count-badge">{project.scenes.length}</span>
          </div>
          <p className="panel-hint">Little moments, one big story.</p>
          <ol className="scene-list">
            {project.scenes.map((s, i) => (
              <li className={displayedIndex === i ? "selected" : ""} key={s.id}>
                <button
                  aria-current={displayedIndex === i ? "step" : undefined}
                  className="scene-card"
                  onClick={() => selectScene(i)}
                >
                  <span className="scene-thumbnail" data-scene-thumbnail={i}>
                    <Stage project={project} scene={s} labelled={false} />
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <small>{s.duration}s</small>
                  </span>
                  <strong>{s.title}</strong>
                </button>
                {index === i && (
                  <div className="scene-card-actions">
                    <button
                      className="icon-button"
                      aria-label={`Move scene ${i + 1} up`}
                      disabled={i === 0 || playing}
                      onClick={() => moveScene(-1)}
                    >
                      <Icon name="up" size={16} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Move scene ${i + 1} down`}
                      disabled={i === project.scenes.length - 1 || playing}
                      onClick={() => moveScene(1)}
                    >
                      <Icon name="down" size={16} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label="Duplicate scene"
                      disabled={playing || project.scenes.length >= 120}
                      onClick={duplicateScene}
                    >
                      <Icon name="copy" size={15} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label="Remove scene"
                      disabled={playing || project.scenes.length === 1}
                      onClick={removeScene}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ol>
          <button
            className="button dashed small add-scene"
            disabled={project.scenes.length >= 120}
            onClick={addScene}
          >
            <Icon name="plus" size={18} />
            Add a scene
          </button>
        </aside>
        <ScenePlayer
          project={project}
          index={index}
          clock={clock}
          selectedId={element?.id}
          onSelect={(id) =>
            setElementIndex(scene.elements.findIndex((e) => e.id === id))
          }
          onMove={(id, x, y) => updateElement(id, { x, y })}
          onResize={(id, scale) => updateElement(id, { scale })}
          onPlaying={setPlaying}
          onIndex={setSelected}
          onSeek={seek}
          onSceneSelect={selectScene}
          onPlay={play}
          scope={scope}
          onScope={(value) => {
            clock.pause();
            setPlaying(false);
            setScope(value);
          }}
          loop={loop}
          onLoop={setLoop}
        >
          <AnimationTimeline
            key={scene.id}
            project={project}
            scene={scene}
            clock={clock}
            sceneOffset={sceneStart(project, index)}
            selectedId={element?.id}
            onSelect={(id) =>
              setElementIndex(scene.elements.findIndex((e) => e.id === id))
            }
            onSeek={seekLocal}
            onChange={changeScene}
          />
        </ScenePlayer>
        <aside className="properties-panel" aria-label="Editing controls">
          <div className="properties-tabs">
            <button
              className={panel === "scene" ? "active" : ""}
              aria-pressed={panel === "scene"}
              onClick={() => setPanel("scene")}
            >
              Scene details
            </button>
            <button
              className={panel === "story" ? "active" : ""}
              aria-pressed={panel === "story"}
              onClick={() => setPanel("story")}
            >
              My story
            </button>
          </div>
          {playing ? (
            <div className="pause-to-edit">
              <Icon name="play" size={30} />
              <h3>Enjoy your little story.</h3>
              <p>Pause to change a scene, a character, or a line.</p>
              <button className="button secondary" onClick={play}>
                Pause & edit
              </button>
            </div>
          ) : panel === "scene" ? (
            <div className="property-fields">
              <CompositionTools
                project={project}
                scene={scene}
                selected={element}
                frame={displayedElement}
                onSelect={(id) =>
                  setElementIndex(scene.elements.findIndex((e) => e.id === id))
                }
                onChange={changeScene}
                onElementChange={changeElement}
                onLibrary={() => onLibrary(index)}
                onSave={() => {
                  if (element)
                    onLibrary(index, libraryItemFromElement(project, element));
                }}
              />
              <label>
                Scene title
                <input
                  maxLength={160}
                  value={scene.title}
                  onChange={(e) =>
                    changeScene({ title: e.target.value || "Untitled scene" })
                  }
                />
              </label>
              <label>
                Narration
                <textarea
                  rows={4}
                  maxLength={6000}
                  value={scene.narration}
                  placeholder="Tell this part of your story…"
                  onChange={(e) => changeScene({ narration: e.target.value })}
                />
              </label>
              <label>
                What do they say?
                <textarea
                  rows={3}
                  maxLength={6000}
                  value={scene.dialogue}
                  placeholder={'Pip: "Let’s try together!"'}
                  onChange={(e) => changeScene({ dialogue: e.target.value })}
                />
              </label>
              <div className="form-grid compact">
                <label>
                  Duration (seconds)
                  <SceneDuration
                    value={scene.duration}
                    onChange={(duration) => changeScene({ duration })}
                  />
                </label>
                <label>
                  Transition
                  <select
                    value={scene.transition}
                    onChange={(e) =>
                      changeScene({
                        transition: e.target.value as Scene["transition"],
                      })
                    }
                  >
                    <option value="fade">Fade</option>
                    <option value="cut">Straight cut</option>
                  </select>
                </label>
              </div>
              <details className="property-group" open>
                <summary>
                  <Icon name="image" size={17} />
                  Set the scene
                </summary>
                <label>
                  Background
                  <select
                    value={scene.background}
                    onChange={(e) =>
                      changeScene({
                        background: e.target.value as Scene["background"],
                      })
                    }
                  >
                    <option value="meadow">Sunny meadow</option>
                    <option value="playground">Neighborhood playground</option>
                    <option value="classroom">Cozy classroom</option>
                    <option value="moonlight">Moonlit meadow</option>
                    <option value="house">House</option>
                    <option value="bedroom">Bedroom</option>
                    <option value="forest">Forest</option>
                    <option value="garden">Garden</option>
                    <option value="beach">Beach</option>
                    <option value="town">Town street</option>
                    <option value="magical">Magical world</option>
                  </select>
                </label>
                <label>
                  Camera view
                  <select
                    value={scene.camera}
                    onChange={(e) =>
                      changeScene({ camera: e.target.value as Scene["camera"] })
                    }
                  >
                    <option value="wide">See the whole scene</option>
                    <option value="close">A little closer</option>
                  </select>
                </label>
                <label>
                  Action notes
                  <textarea
                    rows={2}
                    maxLength={6000}
                    value={scene.action}
                    onChange={(e) => changeScene({ action: e.target.value })}
                  />
                </label>
                <label>
                  Prop notes
                  <input
                    maxLength={500}
                    value={scene.props}
                    placeholder="A kite, a little wagon…"
                    onChange={(e) => changeScene({ props: e.target.value })}
                  />
                </label>
                <p className="field-hint">
                  Action and prop notes guide your story. Set movement below to
                  animate your characters.
                </p>
              </details>
              <details className="property-group" open>
                <summary>
                  <Icon name="heart" size={17} />
                  Characters & movement
                </summary>
                <div className="cast-list">
                  {project.characters.map((c) => (
                    <label className="cast-toggle" key={c.id}>
                      <input
                        type="checkbox"
                        checked={scene.elements.some(
                          (e) => e.characterId === c.id,
                        )}
                        onChange={() => toggleCharacter(c)}
                      />
                      <span style={{ backgroundColor: c.shirt }} />
                      {c.name}
                    </label>
                  ))}
                </div>
                {element && character ? (
                  <>
                    <label>
                      Edit character
                      <select
                        value={element.id}
                        onChange={(e) =>
                          setElementIndex(
                            scene.elements.findIndex(
                              (el) => el.id === e.target.value,
                            ),
                          )
                        }
                      >
                        {scene.elements.map((el) => (
                          <option key={el.id} value={el.id}>
                            {
                              project.characters.find(
                                (c) => c.id === el.characterId,
                              )?.name
                            }
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="form-grid compact">
                      {!character.assetId && (
                        <label>
                          Feeling
                          <select
                            value={displayedElement?.emotion ?? element.emotion}
                            onChange={(e) =>
                              changeElement({
                                emotion: e.target
                                  .value as SceneElement["emotion"],
                              })
                            }
                          >
                            <option value="happy">Happy</option>
                            <option value="sad">Feeling sad</option>
                            <option value="surprised">A bright idea!</option>
                            <option value="calm">Calm</option>
                            <option value="excited">Excited</option>
                            <option value="worried">Worried</option>
                          </select>
                        </label>
                      )}
                      <label>
                        Movement
                        <select
                          value={element.motion}
                          disabled={!!element.animation?.keyframes.length}
                          onChange={(e) =>
                            changeElement({
                              motion: e.target.value as SceneElement["motion"],
                            })
                          }
                        >
                          {[
                            ["still", "Stand still"],
                            ["enter-left", "Enter from left"],
                            ["enter-right", "Enter from right"],
                            ["walk", "Walk across"],
                            ["bounce", "Little jumps"],
                            ["spin", "Turn around"],
                            ["grow", "Grow into view"],
                            ["fade", "Fade in"],
                          ].map(([id, label]) => (
                            <option key={id} value={id}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label>
                      Left ↔ right{" "}
                      <span className="range-value">
                        {Math.round(displayedElement?.x ?? element.x)}
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="800"
                        step="5"
                        value={displayedElement?.x ?? element.x}
                        onChange={(e) =>
                          changeElement({ x: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label>
                      Up ↔ down{" "}
                      <span className="range-value">
                        {Math.round(displayedElement?.y ?? element.y)}
                      </span>
                      <input
                        type="range"
                        min="50"
                        max="450"
                        step="5"
                        value={displayedElement?.y ?? element.y}
                        onChange={(e) =>
                          changeElement({ y: Number(e.target.value) })
                        }
                      />
                    </label>
                    <div className="form-grid compact">
                      <label>
                        Size
                        <input
                          aria-label="Character size"
                          type="range"
                          min="0.3"
                          max="2"
                          step="0.05"
                          value={displayedElement?.scale ?? element.scale}
                          onChange={(e) =>
                            changeElement({ scale: Number(e.target.value) })
                          }
                        />
                      </label>
                      <label>
                        Rotation
                        <input
                          aria-label="Character rotation"
                          type="range"
                          min="-180"
                          max="180"
                          value={displayedElement?.rotation ?? element.rotation}
                          onChange={(e) =>
                            changeElement({ rotation: Number(e.target.value) })
                          }
                        />
                      </label>
                    </div>
                    <label className="inline-check">
                      <input
                        type="checkbox"
                        checked={element.flip}
                        onChange={(e) =>
                          changeElement({ flip: e.target.checked })
                        }
                      />
                      Flip character
                    </label>
                    {!character.assetId && (
                      <label>
                        Pose
                        <select
                          aria-label="Character pose"
                          value={
                            displayedElement?.pose ?? element.pose ?? "standing"
                          }
                          onChange={(e) =>
                            changeElement({ pose: e.target.value as Pose })
                          }
                        >
                          {POSES.map((p) => (
                            <option key={p}>{p}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label>
                      Character name
                      <input
                        maxLength={80}
                        value={character.name}
                        onChange={(e) =>
                          changeCharacter({
                            name: e.target.value || "My character",
                          })
                        }
                      />
                    </label>
                    {character.assetId ? (
                      <p className="field-hint">
                        Your original image is preserved. Movement transforms
                        the whole image; it does not rig its face or limbs.
                      </p>
                    ) : (
                      <>
                        <div className="character-colors">
                          <label>
                            Outfit
                            <input
                              type="color"
                              value={character.shirt}
                              onChange={(e) =>
                                changeCharacter({ shirt: e.target.value })
                              }
                            />
                          </label>
                          <label>
                            Skin
                            <input
                              type="color"
                              value={character.skin}
                              onChange={(e) =>
                                changeCharacter({ skin: e.target.value })
                              }
                            />
                          </label>
                          <label>
                            Hair
                            <input
                              type="color"
                              value={character.hair}
                              onChange={(e) =>
                                changeCharacter({ hair: e.target.value })
                              }
                            />
                          </label>
                        </div>
                        <label>
                          Accessory
                          <select
                            value={character.accessory}
                            onChange={(e) =>
                              changeCharacter({
                                accessory: e.target
                                  .value as Character["accessory"],
                              })
                            }
                          >
                            <option value="none">None</option>
                            <option value="cap">Little cap</option>
                            <option value="bow">Little bow</option>
                          </select>
                        </label>
                      </>
                    )}
                  </>
                ) : (
                  <p className="field-hint">
                    Choose a character above to add them to this scene.
                  </p>
                )}
              </details>
            </div>
          ) : (
            <div className="property-fields">
              <label>
                Cartoon title
                <input
                  maxLength={160}
                  value={project.title}
                  onChange={(e) =>
                    onChange({
                      ...project,
                      title: e.target.value || "Untitled cartoon",
                    })
                  }
                />
              </label>
              <label>
                Story status
                <select
                  value={project.status}
                  onChange={(e) =>
                    onChange({
                      ...project,
                      status: e.target.value as Project["status"],
                    })
                  }
                >
                  <option value="draft">In the making</option>
                  <option value="ready">Ready to share</option>
                </select>
              </label>
              <label>
                Your original spark
                <textarea
                  rows={4}
                  maxLength={6000}
                  value={project.idea}
                  onChange={(e) =>
                    onChange({ ...project, idea: e.target.value })
                  }
                />
              </label>
              <label>
                The lesson
                <input
                  maxLength={500}
                  value={project.lesson}
                  onChange={(e) =>
                    onChange({ ...project, lesson: e.target.value })
                  }
                />
              </label>
              <p className="field-hint">
                Planning notes help you write. Changing them does not overwrite
                your edited scenes.
              </p>
              {(["beginning", "conflict", "response", "ending"] as const).map(
                (key, i) => (
                  <label key={key}>
                    {
                      [
                        "Beginning",
                        "A little challenge",
                        "Helpful response",
                        "Ending",
                      ][i]
                    }
                    <textarea
                      rows={3}
                      maxLength={6000}
                      value={project.outline[key]}
                      onChange={(e) =>
                        onChange({
                          ...project,
                          outline: {
                            ...project.outline,
                            [key]: e.target.value,
                          },
                        })
                      }
                    />
                  </label>
                ),
              )}
              <div className="story-stats">
                <p>
                  <strong>{project.scenes.length}</strong> scenes ·{" "}
                  <strong>{durationLabel(total)}</strong> running time
                </p>
                <p>
                  Episode goal: {project.plannedMinutes} minute
                  {project.plannedMinutes === 1 ? "" : "s"} · Ages{" "}
                  {project.targetAge}
                </p>
                <p>Art direction: {project.artStyle}</p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

function SceneDuration({
  value,
  onChange,
}: {
  value: number;
  onChange: (duration: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);
  return (
    <input
      type="number"
      min="2"
      max="120"
      step="1"
      value={editing ? draft : value}
      onFocus={() => {
        setDraft(String(value));
        setEditing(true);
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        const duration = Number(e.target.value);
        if (duration >= 2 && duration <= 120) onChange(duration);
      }}
      onBlur={() => {
        const parsed = Number(draft);
        const duration =
          draft.trim() && Number.isFinite(parsed)
            ? Math.min(120, Math.max(2, Math.round(parsed)))
            : value;
        if (duration !== value) onChange(duration);
        setEditing(false);
      }}
    />
  );
}
