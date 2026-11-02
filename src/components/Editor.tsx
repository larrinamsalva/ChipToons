import { useEffect, useRef, useState } from "react";
import { clone, durationLabel, makeScene, totalDuration, uid } from "../model";
import type { Character, Project, Scene, SceneElement } from "../model";
import { frameAt, sceneStart } from "../timeline";
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
  const [seconds, setSeconds] = useState(0);
  const timeRef = useRef(0);
  const [panel, setPanel] = useState("scene");
  const [mobilePanel, setMobilePanel] = useState("stage");
  const [elementIndex, setElementIndex] = useState(0);
  const [captions, setCaptions] = useState(true);
  const total = totalDuration(project);
  const index = Math.min(selected, project.scenes.length - 1);
  const frame = frameAt(project, Math.min(seconds, total));
  const scene = playing ? frame.scene : project.scenes[index];
  const displayedIndex = playing ? frame.index : index;
  const element =
    scene.elements[Math.min(elementIndex, scene.elements.length - 1)];
  const character = resolvedCharacter(project, element);
  useEffect(() => {
    if (!playing) return;
    let handle = 0;
    let last = 0;
    function tick(timestamp: number) {
      if (last)
        timeRef.current = Math.min(
          total,
          timeRef.current + (timestamp - last) / 1000,
        );
      last = timestamp;
      setSeconds(timeRef.current);
      if (timeRef.current >= total) {
        setPlaying(false);
        setSelected(project.scenes.length - 1);
        return;
      }
      handle = requestAnimationFrame(tick);
    }
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [playing, total, project.scenes.length]);
  function seek(value: number) {
    const t = Math.max(0, Math.min(total, value));
    timeRef.current = t;
    setSeconds(t);
    setSelected(frameAt(project, t).index);
  }
  function selectScene(next: number) {
    setPlaying(false);
    setSelected(Math.max(0, Math.min(next, project.scenes.length - 1)));
    seek(
      sceneStart(
        project,
        Math.max(0, Math.min(next, project.scenes.length - 1)),
      ),
    );
    setElementIndex(0);
  }
  function play() {
    if (playing) {
      setSelected(frame.index);
      setPlaying(false);
      return;
    }
    if (timeRef.current >= total) seek(0);
    else if (frameAt(project, timeRef.current).index !== index)
      seek(sceneStart(project, index));
    setPlaying(true);
    setMobilePanel("stage");
  }
  function changeScene(patch: Partial<Scene>) {
    setPlaying(false);
    onChange({
      ...project,
      scenes: project.scenes.map((s, i) =>
        i === index ? { ...s, ...patch } : s,
      ),
    });
  }
  function changeElement(patch: Partial<SceneElement>) {
    if (element)
      changeScene({
        elements: scene.elements.map((e) =>
          e.id === element.id ? { ...e, ...patch } : e,
        ),
      });
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
    onChange({ ...project, scenes });
    setSelected(index + 1);
    setPlaying(false);
  }
  function duplicateScene() {
    if (project.scenes.length >= 120) return;
    const copy = clone(scene);
    copy.id = uid();
    copy.title = `${copy.title.slice(0, 150)} (copy)`;
    copy.elements.forEach((e) => {
      e.id = uid();
    });
    const scenes = [...project.scenes];
    scenes.splice(index + 1, 0, copy);
    onChange({ ...project, scenes });
    setSelected(index + 1);
    setPlaying(false);
  }
  function moveScene(direction: number) {
    const next = index + direction;
    if (next < 0 || next >= project.scenes.length) return;
    const scenes = [...project.scenes];
    [scenes[index], scenes[next]] = [scenes[next], scenes[index]];
    onChange({ ...project, scenes });
    setSelected(next);
    setPlaying(false);
  }
  function removeScene() {
    if (project.scenes.length < 2) return;
    onChange({
      ...project,
      scenes: project.scenes.filter((_, i) => i !== index),
    });
    setSelected(Math.max(0, index - 1));
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
        <section className="stage-panel" aria-label="Cartoon preview">
          <div className="stage-header">
            <span>
              <Icon name="film" size={16} />
              SCENE {displayedIndex + 1} OF {project.scenes.length}
            </span>
            <span className="preview-badge">
              {playing ? "Playing your story" : "Live scene preview"}
            </span>
          </div>
          <div className="live-stage">
            <Stage
              project={project}
              scene={scene}
              selectedId={element?.id}
              onSelect={
                playing
                  ? undefined
                  : (id) =>
                      setElementIndex(
                        scene.elements.findIndex((e) => e.id === id),
                      )
              }
              onResize={
                playing
                  ? undefined
                  : (id, scale) =>
                      changeScene({
                        elements: scene.elements.map((e) =>
                          e.id === id ? { ...e, scale } : e,
                        ),
                      })
              }
              onMove={
                playing
                  ? undefined
                  : (id, x, y) =>
                      changeScene({
                        elements: scene.elements.map((e) =>
                          e.id === id ? { ...e, x, y } : e,
                        ),
                      })
              }
              progress={
                playing
                  ? frame.progress
                  : Math.max(
                      0,
                      Math.min(
                        1,
                        (seconds - sceneStart(project, index)) / scene.duration,
                      ),
                    ) || 0.5
              }
            />
            <div className="stage-scene-label">{scene.title}</div>
          </div>
          {captions && (
            <div className="caption-box" aria-live="off">
              <span>NARRATION</span>
              <p>
                {scene.narration ||
                  "Add a little narration to tell your story."}
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
                onClick={() => {
                  setPlaying(false);
                  seek(0);
                }}
              >
                <Icon name="restart" size={19} />
              </button>
              <button
                className="icon-button"
                aria-label="Previous scene"
                disabled={displayedIndex === 0}
                onClick={() => selectScene(displayedIndex - 1)}
              >
                <Icon name="previous" size={19} />
              </button>
              <button
                className="play-button"
                aria-label={playing ? "Pause cartoon" : "Play cartoon"}
                onClick={play}
              >
                <Icon name={playing ? "pause" : "play"} size={21} />
              </button>
              <button
                className="icon-button"
                aria-label="Next scene"
                disabled={displayedIndex === project.scenes.length - 1}
                onClick={() => selectScene(displayedIndex + 1)}
              >
                <Icon name="next" size={19} />
              </button>
              <span className="time-display">
                {durationLabel(Math.min(seconds, total))}
                <span> / {durationLabel(total)}</span>
              </span>
            </div>
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
            step="0.1"
            value={Math.min(seconds, total)}
            onChange={(e) => {
              setPlaying(false);
              seek(Number(e.target.value));
            }}
          />
          <div className="timeline-strip" aria-label="Scene timeline">
            {project.scenes.map((s, i) => (
              <button
                key={s.id}
                style={{ flex: s.duration }}
                className={displayedIndex === i ? "active" : ""}
                aria-label={`Go to scene ${i + 1}: ${s.title}`}
                onClick={() => selectScene(i)}
              >
                <span>{i + 1}</span>
                <small>{s.duration}s</small>
              </button>
            ))}
          </div>
          <p className="preview-note">
            <Icon name="bulb" size={16} />
            This preview is silent. Voices, sound, and video downloads are
            coming in a future release.
          </p>
        </section>
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
                onSelect={(id) =>
                  setElementIndex(scene.elements.findIndex((e) => e.id === id))
                }
                onChange={changeScene}
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
                            value={element.emotion}
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
                      <span className="range-value">{element.x}</span>
                      <input
                        type="range"
                        min="0"
                        max="800"
                        step="5"
                        value={element.x}
                        onChange={(e) =>
                          changeElement({ x: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label>
                      Up ↔ down <span className="range-value">{element.y}</span>
                      <input
                        type="range"
                        min="50"
                        max="450"
                        step="5"
                        value={element.y}
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
                          value={element.scale}
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
                          value={element.rotation}
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
                          value={element.pose ?? "standing"}
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
