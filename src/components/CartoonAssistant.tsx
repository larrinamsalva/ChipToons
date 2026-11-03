import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { EMOTIONS, HEARTS } from "../animation-model";
import { POSES, PROPS } from "../art-model";
import type { PropName } from "../art-model";
import {
  applyDirections,
  createAssistantDraft,
  directScene,
  gentleActions,
  openActors,
  PATTERNS,
  PLAYGROUND_BRIEF,
  shapeActor,
  SHOTS,
  START_BRIEF,
  suggestDirection,
  suggestPattern,
} from "../assistant";
import type { Direction, StoryBrief } from "../assistant";
import { listLibrary } from "../library";
import type { LibraryItem } from "../library";
import { BACKGROUNDS, durationLabel, totalDuration, uid } from "../model";
import type { Project, Scene, SceneElement } from "../model";
import { PlaybackClock } from "../playback";
import { clamp } from "../timeline";
import { Modal } from "./Modal";
import { Stage } from "./Stage";

type CastRow = { name: string; source: string };
type Plan = {
  project: Project;
  positioned: SceneElement[];
  directions: Direction[];
};
const starterCast = [
  { name: "Pip", source: "" },
  { name: "Sunny", source: "" },
  { name: "", source: "" },
];
const word = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const hearts = {
  off: "No heart glow",
  warm: "Warm glow",
  helping: "Bright helping glow",
  sad: "Gentle sadness",
  calm: "Reassuring glow",
  together: "Shared celebration",
};
const backgroundName = (value: string) =>
  ({ town: "Town street", magical: "Magical world" })[value] ?? word(value);

function ScenePreview({ project, scene }: { project: Project; scene: Scene }) {
  const [clock] = useState(() => {
    const playback = new PlaybackClock();
    playback.configure(0, scene.duration, false);
    playback.seek(0.4);
    return playback;
  });
  const [calm, setCalm] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const frame = useSyncExternalStore(clock.subscribe, clock.getSnapshot);
  useEffect(() => {
    clock.configure(0, scene.duration, false);
    return () => clock.pause();
  }, [clock, scene.duration]);
  return (
    <section className="assistant-preview" aria-label="Proposed scene preview">
      <Stage
        project={project}
        scene={scene}
        time={Math.min(frame.seconds, scene.duration)}
        calmPreview={calm}
      />
      <div className="assistant-actions">
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            if (frame.playing) clock.pause();
            else {
              clock.seek(0);
              clock.play();
            }
          }}
        >
          {frame.playing ? "Pause preview" : "Preview this scene"}
        </button>
        <label className="assistant-check">
          <input
            type="checkbox"
            checked={calm}
            onChange={(e) => setCalm(e.target.checked)}
          />{" "}
          Calmer preview
        </label>
      </div>
      <label>
        Preview time (seconds)
        <input
          type="number"
          min={0}
          max={scene.duration}
          step={0.1}
          value={Number(frame.seconds.toFixed(1))}
          onChange={(e) => {
            clock.pause();
            clock.seek(e.target.valueAsNumber || 0);
          }}
        />
      </label>
    </section>
  );
}

export function CartoonAssistant({
  source,
  onClose,
  onApply,
}: {
  source?: Project;
  onClose: () => void;
  onApply: (project: Project) => void | Promise<void>;
}) {
  const [brief, setBrief] = useState(START_BRIEF);
  const [cast, setCast] = useState<CastRow[]>(starterCast);
  const [prop, setProp] = useState<PropName | "">("");
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [libraryNote, setLibraryNote] = useState("");
  const [step, setStep] = useState(0);
  const stepHeading = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (step > 0) stepHeading.current?.focus();
  }, [step]);
  const [patternChosen, setPatternChosen] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(() =>
    source
      ? {
          project: source,
          positioned: [],
          directions: source.scenes.map((scene) =>
            suggestDirection(source, scene, true),
          ),
        }
      : null,
  );
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const field = <K extends keyof StoryBrief>(key: K, value: StoryBrief[K]) =>
    setBrief((prev) => ({ ...prev, [key]: value }));
  const existing = !!source;
  useEffect(() => {
    if (source) return;
    let active = true;
    void listLibrary()
      .then((items) => {
        if (active)
          setLibrary(items.filter((item) => item.kind === "character"));
      })
      .catch(() => {
        if (active)
          setLibraryNote(
            "The saved character library could not be read. You can still use original characters.",
          );
      });
    return () => {
      active = false;
    };
  }, [source]);
  const scene = plan?.project.scenes[index];
  const direction = plan?.directions[index];
  const preview = useMemo(() => {
    if (!plan || !scene || !direction) return null;
    try {
      return directScene(plan.project, scene, direction, existing);
    } catch {
      return scene;
    }
  }, [plan, scene, direction, existing]);

  function next() {
    setError("");
    if (step === 0 && !brief.idea.trim()) {
      setError("Tell us one thing that happens in your story.");
      return;
    }
    if (step === 1 && !cast[0].name.trim()) {
      setError("Give the lead character a name.");
      return;
    }
    if (step === 0 && !patternChosen)
      field("pattern", suggestPattern(brief.idea));
    setStep(step + 1);
  }
  function generate() {
    try {
      setPlan(
        createAssistantDraft(
          brief,
          cast
            .filter((c) => c.name.trim())
            .map((c) => ({
              name: c.name,
              library: library.find((item) => item.id === c.source),
            })),
          prop || undefined,
        ),
      );
      setIndex(0);
      setError("");
      setStep(3);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The story plan could not be prepared.",
      );
    }
  }
  function editScene(change: Partial<Scene>) {
    if (!scene || !plan || !direction || existing) return;
    const edited = { ...scene, ...change };
    const actors = openActors(edited, false);
    const kept = actors.some((e) => e.id === direction.actorId);
    const nextDirection = kept
      ? direction
      : {
          ...direction,
          actorId: actors[0]?.id ?? "",
          action: "none" as const,
          emotion: "keep" as const,
          pose: "keep" as const,
          heart: "off" as const,
          shot:
            direction.shot === "follow" ? ("wide" as const) : direction.shot,
        };
    setPlan({
      ...plan,
      project: {
        ...plan.project,
        scenes: plan.project.scenes.map((s) => (s === scene ? edited : s)),
      },
      directions: plan.directions.map((d) =>
        d === direction
          ? {
              ...nextDirection,
              start: Math.min(nextDirection.start, edited.duration - 0.1),
              seconds: Math.min(nextDirection.seconds, edited.duration),
            }
          : d,
      ),
    });
  }
  function editDirection(change: Partial<Direction>) {
    if (!plan || !direction) return;
    setPlan({
      ...plan,
      directions: plan.directions.map((d) =>
        d === direction ? { ...d, ...change } : d,
      ),
    });
  }
  async function apply() {
    if (!plan || saving) return;
    setError("");
    setSaving(true);
    try {
      await onApply(applyDirections(plan.project, plan.directions, existing));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The reviewed draft could not be applied.",
      );
    } finally {
      setSaving(false);
    }
  }
  const actors = scene ? openActors(scene, existing) : [];
  const actor = actors.find((e) => e.id === direction?.actorId);
  const shape = !!plan && !!actor && shapeActor(plan.project, actor);
  const applied =
    plan?.directions.filter(
      (d) =>
        d.enabled &&
        (d.shot !== "none" ||
          d.action !== "none" ||
          d.emotion !== "keep" ||
          d.pose !== "keep" ||
          d.heart !== "off"),
    ).length ?? 0;
  const reviewing = existing || step >= 3;

  return (
    <Modal
      title={
        existing ? "Review animation suggestions" : "Help Me Make My Cartoon"
      }
      onClose={() => {
        if (!saving) onClose();
      }}
      wide
    >
      <p>
        Local story and animation planner. ChipToons uses editable story
        patterns and action cues. Your story stays on this device.
      </p>
      {!existing && (
        <p
          className="assistant-step"
          role="status"
          tabIndex={-1}
          ref={stepHeading}
        >
          Step {step + 1} of 5 ·{" "}
          {
            [
              "Your idea",
              "Character Director",
              "Setting and lesson",
              "Review the storyboard",
              "Scene Director",
            ][step]
          }
        </p>
      )}
      {!existing && step === 0 && (
        <>
          <div className="assistant-fields">
            <label>
              Cartoon name
              <input
                value={brief.title}
                maxLength={160}
                onChange={(e) => field("title", e.target.value)}
              />
            </label>
            <label>
              Tell us your story idea
              <textarea
                rows={4}
                maxLength={6000}
                value={brief.idea}
                onChange={(e) => field("idea", e.target.value)}
              />
            </label>
            <label>
              What does the lead character want to do?
              <input
                maxLength={500}
                value={brief.goal}
                onChange={(e) => field("goal", e.target.value)}
              />
            </label>
          </div>
          <button
            className="button secondary"
            onClick={() => {
              setBrief(PLAYGROUND_BRIEF);
              setPatternChosen(true);
              setCast([
                { name: "Shine", source: "" },
                { name: "Sunny", source: "" },
                { name: "Sam", source: "" },
              ]);
              setError("");
            }}
          >
            Try The Playground of Kind Hearts
          </button>
        </>
      )}
      {!existing && step === 1 && (
        <section className="assistant-fields" aria-label="Character Director">
          <h3>Choose your cast</h3>
          <p>
            One to three characters work well in a short scene. A library
            character is copied into the draft. Uploaded pictures can move as
            whole images.
          </p>
          {libraryNote && <p role="status">{libraryNote}</p>}
          {cast.map((row, slot) => (
            <fieldset key={slot}>
              <legend>
                {slot === 0
                  ? "Lead character"
                  : `Supporting character ${slot} (optional)`}
              </legend>
              <label>
                Character name {slot + 1}
                <input
                  maxLength={80}
                  value={row.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setCast((prev) =>
                      prev.map((item, i) =>
                        i === slot ? { ...item, name } : item,
                      ),
                    );
                  }}
                />
              </label>
              <label>
                Artwork for character {slot + 1}
                <select
                  value={row.source}
                  onChange={(e) => {
                    const source = e.target.value;
                    const item = library.find((l) => l.id === source);
                    setCast((prev) =>
                      prev.map((row, i) =>
                        i === slot
                          ? { source, name: item?.name ?? row.name }
                          : row,
                      ),
                    );
                  }}
                >
                  <option value="">Original ChipToons character</option>
                  {library.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
          ))}
          <label>
            Acting style
            <select
              value={brief.style}
              onChange={(e) =>
                field("style", e.target.value as StoryBrief["style"])
              }
            >
              <option value="gentle">Gentle</option>
              <option value="expressive">A little more expressive</option>
            </select>
          </label>
          <label className="assistant-check">
            <input
              type="checkbox"
              checked={brief.hearts}
              onChange={(e) => field("hearts", e.target.checked)}
            />{" "}
            Suggest gentle heart effects
          </label>
        </section>
      )}
      {!existing && step === 2 && (
        <section className="assistant-fields" aria-label="Setting and lesson">
          <label>
            Story pattern
            <select
              value={brief.pattern}
              onChange={(e) => {
                setPatternChosen(true);
                field("pattern", e.target.value as StoryBrief["pattern"]);
              }}
            >
              {Object.entries(PATTERNS).map(([key, pattern]) => (
                <option key={key} value={key}>
                  {pattern[0]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Where does the story take place?
            <input
              maxLength={300}
              value={brief.setting}
              onChange={(e) => field("setting", e.target.value)}
              placeholder="For example, a sunny playground"
            />
          </label>
          <label>
            Background
            <select
              value={brief.background}
              onChange={(e) =>
                field("background", e.target.value as Scene["background"])
              }
            >
              {BACKGROUNDS.map((value) => (
                <option key={value} value={value}>
                  {backgroundName(value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Opening prop
            <select
              value={prop}
              onChange={(e) => setProp(e.target.value as PropName | "")}
            >
              <option value="">No prop</option>
              {PROPS.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            What should the audience learn?
            <input
              maxLength={500}
              value={brief.lesson}
              onChange={(e) => field("lesson", e.target.value)}
            />
          </label>
          <details>
            <summary>Add story details (optional)</summary>
            <label>
              Lead character’s goal
              <input
                maxLength={500}
                value={brief.goal}
                onChange={(e) => field("goal", e.target.value)}
              />
            </label>
            <label>
              Small challenge
              <input
                maxLength={500}
                value={brief.challenge}
                onChange={(e) => field("challenge", e.target.value)}
              />
            </label>
            <label>
              Helpful choice
              <input
                maxLength={500}
                value={brief.choice}
                onChange={(e) => field("choice", e.target.value)}
              />
            </label>
            <label>
              Outcome
              <input
                maxLength={500}
                value={brief.outcome}
                onChange={(e) => field("outcome", e.target.value)}
              />
            </label>
          </details>
          <label>
            Scene count
            <select
              value={brief.count}
              onChange={(e) => field("count", Number(e.target.value))}
            >
              {Array.from({ length: 7 }, (_, i) => (
                <option key={i} value={6 + i}>
                  {6 + i}
                  {i === 0 ? " · quick start" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Episode planning goal (minutes)
            <input
              type="number"
              min={1}
              max={30}
              value={brief.minutes}
              onChange={(e) => field("minutes", e.target.valueAsNumber || 1)}
            />
          </label>
          <p className="field-hint">
            A longer episode goal is a planning note. The draft length comes
            from the scenes you approve.
          </p>
          <label className="assistant-check">
            <input
              type="checkbox"
              checked={brief.growing}
              onChange={(e) => field("growing", e.target.checked)}
            />{" "}
            Growing With the Story
          </label>
          {brief.growing && (
            <label>
              Episode number
              <input
                type="number"
                min={1}
                max={30}
                value={brief.episode}
                onChange={(e) => field("episode", e.target.valueAsNumber || 1)}
              />
            </label>
          )}
        </section>
      )}
      {reviewing && plan && scene && direction && preview && (
        <>
          <p>
            {existing
              ? "Select the scenes to update. The assistant adds suggestions to unused tracks and keeps existing motion, audio, captions, artwork and scene timing. You can undo the applied suggestions together."
              : `${plan.project.scenes.length} editable scenes · about ${durationLabel(totalDuration(plan.project))}. This preview shows your proposed draft.`}
          </p>
          <div className="assistant-review">
            <label>
              Review scene
              <select
                value={index}
                onChange={(e) => setIndex(Number(e.target.value))}
              >
                {plan.project.scenes.map((s, i) => (
                  <option key={s.id} value={i}>
                    {i + 1}. {s.title || "Untitled scene"}
                    {existing && plan.directions[i].enabled
                      ? " · selected"
                      : ""}
                  </option>
                ))}
              </select>
            </label>
            <ScenePreview
              key={scene.id}
              project={plan.project}
              scene={preview}
            />
            {step === 3 && !existing && (
              <section
                className="assistant-fields"
                aria-label="Storyboard review"
              >
                <label>
                  Suggested scene title
                  <input
                    maxLength={160}
                    value={scene.title}
                    onChange={(e) => editScene({ title: e.target.value })}
                  />
                </label>
                <label>
                  Suggested narration
                  <textarea
                    rows={3}
                    maxLength={6000}
                    value={scene.narration}
                    onChange={(e) => editScene({ narration: e.target.value })}
                  />
                </label>
                <label>
                  Suggested dialogue
                  <textarea
                    rows={3}
                    maxLength={6000}
                    value={scene.dialogue}
                    onChange={(e) => editScene({ dialogue: e.target.value })}
                  />
                </label>
                <label>
                  Learning question
                  <input
                    maxLength={500}
                    value={scene.question ?? ""}
                    onChange={(e) => editScene({ question: e.target.value })}
                  />
                </label>
                <label>
                  Scene background
                  <select
                    value={scene.background}
                    onChange={(e) =>
                      editScene({
                        background: e.target.value as Scene["background"],
                      })
                    }
                  >
                    {BACKGROUNDS.map((value) => (
                      <option key={value} value={value}>
                        {backgroundName(value)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Scene length (seconds)
                  <input
                    type="number"
                    min={2}
                    max={120}
                    value={scene.duration}
                    onChange={(e) =>
                      editScene({
                        duration: clamp(e.target.valueAsNumber || 2, 2, 120),
                      })
                    }
                  />
                </label>
                <fieldset>
                  <legend>Characters in this scene</legend>
                  {plan.positioned.map((template, i) => (
                    <label
                      className="assistant-check"
                      key={template.characterId}
                    >
                      <input
                        type="checkbox"
                        checked={scene.elements.some(
                          (e) => e.characterId === template.characterId,
                        )}
                        onChange={(e) =>
                          editScene({
                            elements: e.target.checked
                              ? [...scene.elements, { ...template, id: uid() }]
                              : scene.elements.filter(
                                  (e) => e.characterId !== template.characterId,
                                ),
                          })
                        }
                      />
                      {
                        plan.project.characters.find(
                          (c) => c.id === template.characterId,
                        )?.name
                      }{" "}
                      · {i === 0 ? "Lead" : "Supporting"}
                    </label>
                  ))}
                </fieldset>
              </section>
            )}
            {(existing || step === 4) && (
              <section className="assistant-fields" aria-label="Scene Director">
                <h3>Scene Director</h3>
                {existing && <p>{scene.narration}</p>}
                <label className="assistant-check">
                  <input
                    type="checkbox"
                    checked={direction.enabled}
                    onChange={(e) =>
                      editDirection({ enabled: e.target.checked })
                    }
                  />{" "}
                  Include suggestions for this scene
                </label>
                <label>
                  Character to direct
                  <select
                    value={direction.actorId}
                    onChange={(e) =>
                      editDirection({
                        actorId: e.target.value,
                        action: "none",
                        emotion: "keep",
                        pose: "keep",
                        heart: "off",
                        shot:
                          direction.shot === "follow" && !e.target.value
                            ? "none"
                            : direction.shot,
                      })
                    }
                  >
                    <option value="">No character action</option>
                    {actors.map((el) => (
                      <option key={el.id} value={el.id}>
                        {plan.project.characters.find(
                          (c) => c.id === el.characterId,
                        )?.name ?? el.name}
                      </option>
                    ))}
                  </select>
                </label>
                {actor && (
                  <>
                    {!shape && (
                      <p className="field-hint">
                        This character uses image artwork. Movement applies to
                        the whole picture.
                      </p>
                    )}
                    <label>
                      Suggested action
                      <select
                        value={direction.action}
                        onChange={(e) =>
                          editDirection({
                            action: e.target.value as Direction["action"],
                          })
                        }
                      >
                        <option value="none">No movement</option>
                        {gentleActions(shape).map(([id, label]) => (
                          <option key={id} value={id}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {shape && (
                      <>
                        <label>
                          Expression
                          <select
                            value={direction.emotion}
                            onChange={(e) =>
                              editDirection({
                                emotion: e.target.value as Direction["emotion"],
                              })
                            }
                          >
                            <option value="keep">Keep expression</option>
                            {EMOTIONS.map((value) => (
                              <option key={value}>{value}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Pose
                          <select
                            value={direction.pose}
                            onChange={(e) =>
                              editDirection({
                                pose: e.target.value as Direction["pose"],
                              })
                            }
                          >
                            <option value="keep">Keep pose</option>
                            {POSES.map((value) => (
                              <option key={value}>{value}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Heart effect
                          <select
                            value={direction.heart}
                            onChange={(e) =>
                              editDirection({
                                heart: e.target.value as Direction["heart"],
                              })
                            }
                          >
                            {HEARTS.map((value) => (
                              <option key={value} value={value}>
                                {hearts[value] ?? word(value)}
                              </option>
                            ))}
                          </select>
                        </label>
                      </>
                    )}
                    <div className="assistant-numbers">
                      <label>
                        Action starts (seconds)
                        <input
                          type="number"
                          min={0}
                          max={Math.max(0, scene.duration - 0.1)}
                          step={0.1}
                          value={direction.start}
                          onChange={(e) =>
                            editDirection({
                              start: clamp(
                                e.target.valueAsNumber || 0,
                                0,
                                scene.duration - 0.1,
                              ),
                            })
                          }
                        />
                      </label>
                      <label>
                        Action length (seconds)
                        <input
                          type="number"
                          min={0.1}
                          max={scene.duration}
                          step={0.1}
                          value={direction.seconds}
                          onChange={(e) =>
                            editDirection({
                              seconds: clamp(
                                e.target.valueAsNumber || 0.1,
                                0.1,
                                scene.duration,
                              ),
                            })
                          }
                        />
                      </label>
                    </div>
                    {!existing && (
                      <div className="assistant-numbers">
                        {(["x", "y"] as const).map((axis) => (
                          <label key={axis}>
                            Character position {axis.toUpperCase()}
                            <input
                              type="number"
                              min={0}
                              max={axis === "x" ? 800 : 450}
                              value={actor[axis]}
                              onChange={(e) =>
                                editScene({
                                  elements: scene.elements.map((el) =>
                                    el === actor
                                      ? {
                                          ...el,
                                          [axis]: clamp(
                                            e.target.valueAsNumber || 0,
                                            0,
                                            axis === "x" ? 800 : 450,
                                          ),
                                        }
                                      : el,
                                  ),
                                })
                              }
                            />
                          </label>
                        ))}
                      </div>
                    )}
                  </>
                )}
                {existing &&
                (scene.cameraAnimation || scene.camera !== "wide") ? (
                  <p>Existing camera framing is kept.</p>
                ) : (
                  <label>
                    Camera suggestion
                    <select
                      value={direction.shot}
                      onChange={(e) =>
                        editDirection({
                          shot: e.target.value as Direction["shot"],
                        })
                      }
                    >
                      {Object.entries(SHOTS)
                        .filter(([id]) => id !== "follow" || actor)
                        .map(([id, title]) => (
                          <option key={id} value={id}>
                            {title}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <p className="field-hint">
                  The preview plays the proposed timing. Use No movement, No
                  camera suggestion, or clear the scene’s inclusion to reject
                  suggestions.
                </p>
              </section>
            )}
          </div>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="modal-actions assistant-actions">
        <button
          className="button secondary"
          disabled={saving}
          onClick={onClose}
        >
          Cancel
        </button>
        {!existing && step > 0 && (
          <button
            className="button secondary"
            disabled={saving}
            onClick={() => {
              setStep(step - 1);
              setError("");
            }}
          >
            Back
          </button>
        )}
        {!existing && step < 2 && (
          <button className="button primary" onClick={next}>
            Next
          </button>
        )}
        {!existing && step === 2 && (
          <button className="button primary" onClick={generate}>
            Suggest scenes
          </button>
        )}
        {!existing && step === 3 && (
          <button className="button primary" onClick={next}>
            Review actions and camera
          </button>
        )}
        {(existing || step === 4) && (
          <button
            className="button primary"
            disabled={saving || (existing && applied === 0)}
            onClick={() => void apply()}
          >
            {saving
              ? "Applying…"
              : existing
                ? `Apply reviewed suggestions (${applied} ${applied === 1 ? "scene" : "scenes"})`
                : "Create animated first draft"}
          </button>
        )}
      </div>
    </Modal>
  );
}
