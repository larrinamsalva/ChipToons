import { STORY_CARD_STUDIO } from "../story-card-model";
import { SOUND_DIRECTOR_TITLE } from "../sound-director";
import { SHOT_TITLE, shotIssue } from "../camera-shots";
import type { SoundDirectorSeed } from "./SoundDirector";
import { ATMOSPHERES, editSoundClip, isAtmosphere, reconcileSoundClips } from "../sound-cues";
import { PARTICIPATION_TITLE, participationIssue } from "../participation-model";
import { FOCUS_TITLE, focusIssue } from "../focus-model";
import type { FocusSeed } from "../focus-studio";
import { TRANSFORM_TITLE, TransformStudio } from "./TransformStudio";
import { transformIssue } from "../transform-model";
import { INTERACTION_TITLE, InteractionStudio } from "./InteractionStudio";
import { interactionSuggestion } from "../interaction-studio";
import type { InteractionSuggestion } from "../interaction-studio";
import { interactionReferencesExist } from "../interaction-model";
import type { AudioFile } from "../audio-vault";
import { PreviewAudio } from "../audio-engine";
import type { AudioCategory } from "../media-model";
import { reconcileProduction, duplicateSceneMedia } from "../production";
import { duplicateScript, reconcileScriptClips } from "../script";
import { copySceneVoice } from "../voice-mouth";
import { VoiceStudio } from "./VoiceStudio";
import { lazy, memo, Suspense, useEffect, useRef, useState } from "react";
import { StoryOverview } from "./StoryOverview";
import { CharacterReference } from "./CharacterReference";
import { CreatorGuide } from "./CreatorGuide";
import { CHAPTERS } from "../story-model";
import { chapterOf } from "../story";
import type { ChapterId } from "../story-model";
import { Modal } from "./Modal";
import {
  makeScene,
  totalDuration,
  uid,
  durationLabel,
  validateProject,
} from "../model";
import type { Asset, Character, Project, Scene, SceneElement } from "../model";
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
import { LittleFixersVoiceBoard } from "./LittleFixersVoiceBoard";
import { isLittleFixersVoiceProject } from "../little-fixers-voice-readiness";
import { CompositionTools } from "./CompositionTools";
import { resolvedCharacter, libraryItemFromElement, libraryItemFromLocation } from "../library";
import type { LibraryItem, LibraryKind } from "../library";
import { POSES } from "../art-model";
import type { Pose } from "../art-model";

const StoryCardStudio = lazy(() => import("./StoryCardStudio").then(module => ({ default: module.StoryCardStudio })));
const VoiceMouthStudio = lazy(() => import("./VoiceMouthStudio").then(module => ({ default: module.VoiceMouthStudio })));
const ShotDirector = lazy(() => import("./ShotDirector").then(module => ({ default: module.ShotDirector })));
const SoundDirector = lazy(() => import("./SoundDirector").then(module => ({ default: module.SoundDirector })));
const ParticipationStudio = lazy(() => import("./ParticipationStudio").then(module => ({ default: module.ParticipationStudio })));
const FocusStudio = lazy(() => import("./FocusStudio").then(module => ({ default: module.FocusStudio })));
const ScriptDirector = lazy(() => import("./ScriptDirector").then(module => ({ default: module.ScriptDirector })));

const FinishCartoon = lazy(() =>
  import("./FinishCartoon").then((m) => ({ default: m.FinishCartoon })),
);

// Unchanged scene thumbnails do not rerender when another scene or media is edited.
const SceneThumbnail = memo(
  ({ project, scene }: { project: Project; scene: Scene }) => (
    <Stage project={project} scene={scene} labelled={false} />
  ),
  (a, b) =>
    a.scene === b.scene &&
    a.project.characters === b.project.characters &&
    a.project.assets === b.project.assets,
);

export function Editor({
  project,
  startScript = false,
  onChange,
  onConvert,
  onBack,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  saveStatus,
  saveError,
  onRetry,
  onLibrary,
  onPicture,
  onAssistant,
}: {
  project: Project;
  startScript?: boolean;
  onChange: (p: Project) => void;
  onConvert: (p: Project, files: AudioFile[]) => Promise<void>;
  onBack: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  saveStatus: string;
  saveError: string;
  onRetry: () => void;
  onPicture?: (sceneIndex: number) => void;
  onLibrary: (sceneIndex: number, draft?: LibraryItem, kind?: LibraryKind) => void;
  onAssistant: () => void;
}) {
  const [backupReminder, setBackupReminder] = useState(true);
  const [overview, setOverview] = useState(false),
    [reference, setReference] = useState(false),
    [guide, setGuide] = useState(false);
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [audio] = useState(() => new PreviewAudio());
  const [sound, setSound] = useState(true),
    [audioBusy, setAudioBusy] = useState(false);
  const playTicket = useRef(0);
  const [mouthStudio, setMouthStudio] = useState<{ clipId?: string }>();
  const [storyCardsOpen, setStoryCardsOpen] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(startScript);
  const [voiceBoardOpen, setVoiceBoardOpen] = useState(false);
  const [scriptLine, setScriptLine] = useState("");
  const [scriptStep, setScriptStep] = useState<string>();
  const [voiceStudio, setVoiceStudio] = useState<{
      clipId?: string;
      lineId?: string;
      category?: AudioCategory;
      tab?: "sound" | "captions";
    } | null>(null),
    [finish, setFinish] = useState(false);
  const [clock] = useState(() => new PlaybackClock());
  const [scope, setScope] = useState<"episode" | "scene">("episode");
  const [loop, setLoop] = useState(false);
  const [editError, setEditError] = useState("");
  const [interactionNotice, setInteractionNotice] = useState("");
  const [shotEditor, setShotEditor] = useState<{ id?: string; lineId?: string; inspectAt?: number; inspectKind?: "voice" | "gap" | "voice-unavailable"; preset?: "framefield-push" | "framefield-pan" | "framefield-tilt" | "framefield-glide" | "framefield-reveal" }>();
  const [soundDirector, setSoundDirector] = useState<SoundDirectorSeed>();
  const [participationEditor, setParticipationEditor] = useState<{ id?: string; stepId?: string }>();
  const [focusEditor, setFocusEditor] = useState<{ graphicId?: string; seed?: FocusSeed }>();
  const [transformEditor, setTransformEditor] = useState<{ objectId?: string; changeId?: string }>();
  const [interactionEditor, setInteractionEditor] = useState<{ id?: string; suggestion?: InteractionSuggestion }>();
  const [editSeconds, setEditSeconds] = useState(0);
  const [panel, setPanel] = useState("scene");
  const [worldOpen, setWorldOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState("stage");
  const [elementIndex, setElementIndex] = useState(0);

  const total = totalDuration(project);
  const index = Math.min(selected, project.scenes.length - 1);
  const scene = project.scenes[index];
  const displayedIndex = index;
  const pageStart = Math.floor(index / 12) * 12;
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
  function halt() {
    playTicket.current++;
    audio.stop();
    clock.setTimeSource();
    clock.pause();
    setPlaying(false);
    setAudioBusy(false);
  }
  useEffect(() => {
    const off = clock.subscribe(() => {
      if (!clock.getSnapshot().playing) {
        audio.stop();
        clock.setTimeSource();
      }
    });
    return () => {
      off();
      clock.dispose();
      audio.dispose();
    };
  }, [clock, audio]);
  function openVoice(
    clipId?: string,
    category?: AudioCategory,
    tab?: "sound" | "captions",
  ) {
    halt();
    setVoiceStudio({ clipId, category, tab });
  }
  function updateProduction(next: Project) {
    halt();
    try {
      const reconciled = reconcileScriptClips({ ...next, audioClips: reconcileSoundClips(next.audioClips, next.scenes) });
      validateProject(reconciled);
      onChange(reconciled);
      setEditError("");
      return true;
    } catch (e) {
      setEditError(
        e instanceof Error ? e.message : "Media could not be saved.",
      );
      return false;
    }
  }

  function seek(value: number) {
    halt();
    clock.configure(0, total, false);
    const t = clamp(value, 0, total);
    clock.seek(t);
    setEditSeconds(t);
    setSelected(frameAt(project, t).index);
    halt();
    setPlaying(false);
  }
  function seekLocal(value: number) {
    halt();
    clock.configure(0, total, false);
    clock.seek(sceneStart(project, index) + clamp(value, 0, scene.duration));
    setEditSeconds(clock.getSnapshot().seconds);
    halt();
    setPlaying(false);
  }
  function applyStoryCard(next: Project, nextIndex: number, script = false) {
    if (!updateProduction(next)) return;
    const start = sceneStart(next, nextIndex);
    clock.configure(0, totalDuration(next), false);
    clock.seek(start);
    setEditSeconds(start);
    setSelected(nextIndex);
    setElementIndex(0);
    setStoryCardsOpen(false);
    if (script) { setScriptLine(""); setScriptStep(undefined); setScriptOpen(true); }
  }

  function selectScene(next: number) {
    const i = clamp(next, 0, project.scenes.length - 1);
    seek(sceneStart(project, i));
    setSelected(i);
    setElementIndex(0);
  }
  async function play(forceEpisode = false, withSound = sound, playScope = scope) {
    if (clock.getSnapshot().playing && !forceEpisode) {
      const t = clock.getSnapshot().seconds;
      setEditSeconds(t);
      halt();
      if (scope === "episode") setSelected(frameAt(project, t).index);
      return;
    }
    if (audioBusy) return;
    halt();
    const ticket = ++playTicket.current;
    setSound(withSound);
    const mode = forceEpisode ? "episode" : playScope,
      start = mode === "scene" ? sceneStart(project, index) : 0,
      end = mode === "scene" ? start + scene.duration : total;
    if (forceEpisode) {
      setScope("episode");
      setSelected(0);
      setSound(withSound);
    }
    clock.configure(start, end, mode === "scene" && loop);
    let offset = forceEpisode ? 0 : clock.getSnapshot().seconds;
    if (offset < start || offset >= end) offset = start;
    clock.seek(offset);
    try {
      if (withSound && project.audioClips.some((c) => !c.muted)) {
        setAudioBusy(true);
        const source = await audio.start(
          project,
          offset,
          start,
          end,
          mode === "scene" && loop,
          (error) => {
            setEditSeconds(clock.getSnapshot().seconds);
            halt();
            setEditError(error.message);
          },
        );
        if (playTicket.current !== ticket) return;
        clock.setTimeSource(source);
      } else clock.setTimeSource();
      if (playTicket.current !== ticket) return;
      clock.play();
      setPlaying(true);
      setMobilePanel("stage");
    } catch (e) {
      if (
        playTicket.current === ticket &&
        !(e instanceof DOMException && e.name === "AbortError")
      )
        setEditError(
          e instanceof Error
            ? e.message
            : "Audio preview could not start. Turn Sound off to inspect animation.",
        );
    } finally {
      if (playTicket.current === ticket) setAudioBusy(false);
    }
  }
  function changeScene(patch: Partial<Scene>, assets: Asset[] = project.assets) {
    setEditSeconds(clock.getSnapshot().seconds);
    halt();
    setPlaying(false);
    let next = { ...scene, ...patch };
    if (patch.duration !== undefined && patch.duration !== scene.duration)
      next = retimeScene(scene, patch.duration);
    const ids = new Set(next.elements.map(item => item.id));
    const changedRole = next.interactions?.some(action => !interactionReferencesExist(action, next.elements) &&
      ids.has(action.actorId) && ids.has(action.objectId) && (!action.transfer || ids.has(action.transfer.actorId)));
    if (changedRole) {
      setEditError("This object is part of an interaction. Remove that action in the timeline before changing the object's role.");
      return false;
    }
    const actionsBeforeCleanup = next.interactions?.length ?? 0;
    next = cleanSceneReferences(next, scene);
    const transformationIssue = transformIssue(next.objectTracks, next, new Set(assets.map(asset => asset.id)));
    if (transformationIssue) {
      setEditError(transformationIssue);
      return false;
    }
    const teachingIssue = participationIssue(next.participation, next) || focusIssue(next.focusGraphics, next) || shotIssue(next.cameraShots, next);
    if (teachingIssue) {
      setEditError(teachingIssue);
      return false;
    }
    const scenes = project.scenes.map((s, i) => (i === index ? next : s));
    const updated = {
      ...project,
      scenes,
      assets,
      ...reconcileProduction(project, scenes),
    };
    try {
      validateProject(updated);
      onChange(updated);
      setEditError("");
      const removedTransform = (scene.objectTracks?.length ?? 0) > (next.objectTracks?.length ?? 0);
      const missingFocus = (next.focusGraphics?.filter(item => item.target.kind === "missing").length ?? 0) >
        (scene.focusGraphics?.filter(item => item.target.kind === "missing").length ?? 0);
      setInteractionNotice(missingFocus
        ? "A teaching graphic lost its target. Open its timeline marker to choose another object or keep its screen position."
        : removedTransform ? "An appearance track was removed. Undo to bring back its changes."
        : actionsBeforeCleanup > (next.interactions?.length ?? 0)
          ? "A character or object was removed, so its linked interaction was removed too. Undo to bring both back." : "");
    } catch (e) {
      setEditError(
        e instanceof Error ? e.message : "This edit could not be saved.",
      );
      return false;
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
    return true;
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
  function addScene(dedicated?: Scene) {
    if (project.scenes.length >= 120) return false;
    const scenes = [...project.scenes];
    scenes.splice(index + 1, 0, dedicated ?? {
      ...makeScene(project.characters, scenes.length),
      chapter: chapterOf(scene, index, project.scenes.length),
    });
    try {
      validateProject({
        ...project,
        scenes,
        ...reconcileProduction(project, scenes),
      });
    } catch {
      setEditError(
        "This scene would exceed the project animation or artwork limits. Your project is unchanged.",
      );
      return false;
    }
    onChange({ ...project, scenes, ...reconcileProduction(project, scenes) });
    setSelected(index + 1);
    halt();
    clock.configure(
      0,
      scenes.reduce((n, s) => n + s.duration, 0),
      false,
    );
    clock.seek(scenes.slice(0, index + 1).reduce((n, s) => n + s.duration, 0));
    setPlaying(false);
    return true;
  }
  function duplicateScene() {
    if (project.scenes.length >= 120) return;
    const cues = new Map<string, string>();
    const animated = duplicateAnimatedScene(scene, cues);
    const media = duplicateSceneMedia(project, scene, animated, cues);
    const originals = project.audioClips.filter(clip => clip.sceneId === scene.id);
    const copies = media.audioClips.slice(project.audioClips.length);
    const copy = duplicateScript(copySceneVoice(scene, animated, originals, copies), originals, copies);
    copy.title = `${copy.title.slice(0, 150)} (copy)`;
    const scenes = [...project.scenes];
    scenes.splice(index + 1, 0, copy);
    try {
      validateProject({
        ...project,
        scenes,
        ...media,
      });
    } catch {
      setEditError(
        "This scene would exceed the project animation or artwork limits. Your project is unchanged.",
      );
      return;
    }
    onChange({
      ...project,
      scenes,
      ...media,
    });
    setSelected(index + 1);
    halt();
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
      validateProject({
        ...project,
        scenes,
        ...reconcileProduction(project, scenes),
      });
    } catch {
      setEditError(
        "This scene would exceed the project animation or artwork limits. Your project is unchanged.",
      );
      return;
    }
    onChange({ ...project, scenes, ...reconcileProduction(project, scenes) });
    setSelected(next);
    halt();
    clock.configure(0, total, false);
    clock.seek(scenes.slice(0, next).reduce((n, s) => n + s.duration, 0));
    setPlaying(false);
  }
  function removeScene() {
    if (project.scenes.length < 2) return;
    onChange({
      ...project,
      scenes: project.scenes.filter((_, i) => i !== index),
      ...reconcileProduction(
        project,
        project.scenes.filter((_, i) => i !== index),
      ),
    });
    const remaining = project.scenes.filter((_, i) => i !== index),
      next = Math.max(0, index - 1);
    setSelected(next);
    halt();
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
          <label className="cinematic-look-toggle" title="Optional illustrated lighting and expressive puppet details; changes the preview and video export, not the script or movement.">
            <input type="checkbox" aria-label="Cinematic Storybook look"
              checked={project.visualStyle === "storybook-cinematic"}
              onChange={event => onChange({
                ...project,
                visualStyle: event.target.checked ? "storybook-cinematic" : undefined,
              })} />
            Cinematic Storybook look
          </label>
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
      {backupReminder && (
        <div className="backup-reminder">
          <span>
            Local saving stays in this browser. Keep a portable project backup
            before clearing browser data or changing devices.
          </span>
          <button
            className="button text small"
            onClick={() => {
              exportProject(project);
              setBackupReminder(false);
            }}
          >
            Back up now
          </button>
          <button
            className="icon-button"
            aria-label="Dismiss backup reminder"
            onClick={() => setBackupReminder(false)}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
      <nav className="production-steps" aria-label="Cartoon production steps">
        {[
          "Story",
          "Artwork",
          "Animation",
          "Voices & Sound",
          "Preview",
          "Export",
        ].map((step) => (
          <button
            key={step}
            aria-label={`Production step: ${step}`}
            onClick={() => {
              halt();
              if (step === "Story") {
                setPanel("story");
                setMobilePanel("properties");
              } else if (step === "Artwork") onLibrary(index);
              else if (step === "Voices & Sound") openVoice();
              else if (step === "Export") setFinish(true);
              else {
                setMobilePanel("stage");
                requestAnimationFrame(() =>
                  document
                    .querySelector(
                      step === "Animation"
                        ? ".animation-studio"
                        : ".stage-panel",
                    )
                    ?.scrollIntoView({ block: "start" }),
                );
              }
            }}
          >
            {step}
          </button>
        ))}
      </nav>
      <div className="editor-toolbar">
        <div className="studio-label">
          <span className="studio-dot" />
          Let’s bring your story to life.
        </div>
        <div className="toolbar-actions">
          <button
            className="button secondary small"
            onClick={() => {
              halt();
              setOverview(true);
            }}
          >
            Story chapters
          </button>
          <button className="button secondary small" onClick={() => { halt(); setScriptStep(undefined); setScriptOpen(true); }}>
            Write My Episode Script
          </button>
          {isLittleFixersVoiceProject(project) && (
            <button className="button secondary small" onClick={() => {
              halt();
              setScriptOpen(false);
              setVoiceBoardOpen(true);
            }}>Finish the Little Fixers voices</button>
          )}
          <button className="button secondary small" onClick={() => { halt(); setStoryCardsOpen(true); }}>
            {STORY_CARD_STUDIO}
          </button>
          <button className="button secondary small" onClick={() => { halt(); setMouthStudio({}); }}>
            Make My Character Talk
          </button>
          <button
            className="button text small"
            onClick={() => {
              halt();
              setGuide(true);
            }}
          >
            Guided tutorial
          </button>
          <button className="button text small" onClick={() => { halt(); setPlaying(false); onAssistant(); }}>
            Review animation suggestions
          </button>
          <button
            className="button primary small finish-button"
            onClick={() => {
              halt();
              setFinish(true);
            }}
          >
            Finish My Cartoon
          </button>
          <button
            className="button secondary small"
            onClick={() => openVoice()}
          >
            Voices & Sound
          </button>
          <button
            className="button secondary small"
            onClick={() => {
              halt();
              setPlaying(false);
              onLibrary(index);
            }}
          >
            <Icon name="folder" size={17} />
            Art library
          </button>
          {onPicture && <button className="button secondary small" onClick={() => {
            halt();
            setPlaying(false);
            onPicture(index);
          }}>Picture &amp; cutouts</button>}
          <button
            className="icon-button"
            aria-label="Undo edit"
            disabled={!canUndo}
            onClick={() => {
              halt();
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
              halt();
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
      {interactionNotice && <p role="status" className="animation-message">{interactionNotice}</p>}
      <div className={`editor-workspace mobile-show-${mobilePanel}`}>
        <aside className="scene-panel" aria-label="Storyboard scenes">
          <div className="panel-heading">
            <h2>Your storyboard</h2>
            <span className="count-badge">{project.scenes.length}</span>
          </div>
          <p className="panel-hint">Little moments, one big story.</p>
          {project.scenes.length > 12 && (
            <div className="scene-pagination">
              <button
                className="icon-button"
                aria-label="Previous 12 storyboard scenes"
                disabled={pageStart === 0}
                onClick={() => selectScene(pageStart - 1)}
              >
                <Icon name="previous" />
              </button>
              <span>
                {pageStart + 1}–
                {Math.min(pageStart + 12, project.scenes.length)} of{" "}
                {project.scenes.length}
              </span>
              <button
                className="icon-button"
                aria-label="Next 12 storyboard scenes"
                disabled={pageStart + 12 >= project.scenes.length}
                onClick={() => selectScene(pageStart + 12)}
              >
                <Icon name="next" />
              </button>
            </div>
          )}
          <ol className="scene-list" start={pageStart + 1}>
            {project.scenes.slice(pageStart, pageStart + 12).map((s, n) => {
              const i = pageStart + n;
              return (
                <li
                  className={displayedIndex === i ? "selected" : ""}
                  key={s.id}
                >
                  <button
                    aria-current={displayedIndex === i ? "step" : undefined}
                    className="scene-card"
                    onClick={() => selectScene(i)}
                  >
                    <span className="scene-thumbnail" data-scene-thumbnail={i}>
                      <SceneThumbnail project={project} scene={s} />
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      <small>{s.duration}s</small>
                    </span>
                    <strong>{s.title}</strong>
                    <span className="scene-chapter-label" aria-hidden="true">
                      {
                        CHAPTERS.find(
                          (c) =>
                            c.id === chapterOf(s, i, project.scenes.length),
                        )?.label
                      }
                    </span>
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
              );
            })}
          </ol>
          <button
            className="button dashed small add-scene"
            disabled={project.scenes.length >= 120}
            onClick={() => addScene()}
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
          onPlay={() => void play()}
          sound={sound}
          audioBusy={audioBusy}
          onSound={(value) => {
            halt();
            setSound(value);
          }}
          scope={scope}
          onScope={(value) => {
            halt();
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
            onAudioEdit={(id, category) => {
              const clip = project.audioClips.find(item => item.id === id);
              if (clip?.soundCue || clip?.ambience || clip?.soundReview) {
                halt(); setSoundDirector({ clipId: id, atmosphere: !!clip.ambience || clip.soundReview === "range-changed" });
              } else openVoice(id, category);
            }}
            onAudioMove={(id, start) =>
              updateProduction({
                ...project,
                audioClips: project.audioClips.map((c) =>
                  c.id === id ? editSoundClip(c, { start }) : c,
                ),
              })
            }
            onSelect={(id) =>
              setElementIndex(scene.elements.findIndex((e) => e.id === id))
            }
            onSeek={seekLocal}
            onChange={changeScene}
            onInteraction={(id) => { halt(); setInteractionEditor({ id }); }}
            onTransform={(objectId, changeId) => { halt(); setTransformEditor({ objectId, changeId }); }}
            onFocus={graphicId => { halt(); setFocusEditor({ graphicId }); }}
            onParticipation={id => { halt(); setParticipationEditor({ id }); }}
            onShot={id => { halt(); setShotEditor({ id }); }}
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
              <button className="button secondary" onClick={() => void play()}>
                Pause & edit
              </button>
            </div>
          ) : panel === "scene" ? (
            <div className="property-fields">
              <section className="world-tools">
                <button className="button secondary" onClick={() => {
                  halt(); setInteractionEditor({});
                }}>{INTERACTION_TITLE}</button>
                <button className="button secondary" onClick={() => {
                  halt(); setTransformEditor({ objectId: element?.id });
                }}>{TRANSFORM_TITLE}</button>
                <button className="button secondary" onClick={() => { halt(); setFocusEditor({}); }}>{FOCUS_TITLE}</button>
                <button className="button secondary" onClick={() => { halt(); setParticipationEditor({}); }}>{PARTICIPATION_TITLE}</button>
                <button className="button secondary" onClick={() => { halt(); setSoundDirector({}); }}>{SOUND_DIRECTOR_TITLE}</button>
                <button className="button secondary" onClick={() => { halt(); setShotEditor({}); }}>{SHOT_TITLE}</button>
              </section>
              <section className="world-tools">
                <button className="button secondary" aria-expanded={worldOpen} aria-controls="world-controls"
                  onClick={() => setWorldOpen(value => !value)}>Build My Cartoon World</button>
                <div className="world-fields" id="world-controls" hidden={!worldOpen}>
                  <h3>Arrange My Scene</h3>
                  <p className="field-hint">Choose a starter, or build with a background and props. Drag items on the stage or use the object controls below.
                    Mark decorations as scenery to include them in your saved location.</p>
                  <div className="series-actions">
                    <button className="button secondary small" onClick={() => onLibrary(index, undefined, "location")}>Browse reusable locations</button>
                    <button className="button secondary small" onClick={() => onLibrary(index, undefined, "background")}>Choose a background</button>
                    <button className="button secondary small" onClick={() => onLibrary(index, undefined, "prop")}>Add scenery props</button>
                    <button className="button secondary small" onClick={() => { halt(); setSoundDirector({ atmosphere: true }); }}>
                      Review location atmosphere
                    </button>
                    <button className="button primary small" onClick={() => {
                      try { onLibrary(index, libraryItemFromLocation(project, scene)); }
                      catch (error) { setEditError(error instanceof Error ? error.message : "This location could not be prepared."); }
                    }}>Save as reusable location</button>
                  </div>
                  <label>Suggested atmosphere for this location<select value={scene.suggestedAtmosphere ?? ""}
                    onChange={event => {
                      const value = event.target.value;
                      changeScene({ suggestedAtmosphere: isAtmosphere(value) ? value : undefined });
                    }}>
                    <option value="">No suggested sound</option>
                    {Object.entries(ATMOSPHERES).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}
                  </select></label>
                  <label className="world-check"><input type="checkbox" checked={!!scene.gentleDepth}
                    onChange={event => changeScene({ gentleDepth: event.target.checked })} /> Gentle depth during camera pans</label>
                  <label className="world-check"><input type="checkbox" checked={!!scene.backgroundAnimation?.enabled}
                    onChange={event => changeScene({ backgroundAnimation: {
                      ...scene.backgroundAnimation, enabled: event.target.checked,
                      style: scene.backgroundAnimation?.style ?? "drift", keyframes: scene.backgroundAnimation?.keyframes ?? [],
                    } })} /> Gentle scenery animation</label>
                  <button className="button secondary small" onClick={() => {
                    setScope("scene");
                    void play(false, sound, "scene");
                  }}>Preview this scene with characters</button>
                  <p className="field-hint">Choose Walk across for a character to see how foreground objects overlap it.
                    Use Camera view below for a wide or closer shot.</p>
                </div>
              </section>
              <CompositionTools
                worldOpen={worldOpen}
                project={project}
                scene={scene}
                selected={element}
                frame={displayedElement}
                onSelect={(id) =>
                  setElementIndex(scene.elements.findIndex((e) => e.id === id))
                }
                onChange={patch => {
                  changeScene(patch);
                  const next = patch.elements?.findIndex(item => item.id === element?.id);
                  if (next !== undefined && next >= 0) setElementIndex(next);
                }}
                onElementChange={changeElement}
                onLibrary={() => onLibrary(index)}
                onSave={() => {
                  if (element)
                    onLibrary(index, libraryItemFromElement(project, element));
                }}
              />
              {character && (
                <button
                  className="button secondary small"
                  onClick={() => {
                    halt();
                    setReference(true);
                  }}
                >
                  Character reference
                </button>
              )}
              <label>
                Chapter
                <select
                  aria-label="Chapter"
                  value={chapterOf(scene, index, project.scenes.length)}
                  onChange={(e) =>
                    changeScene({ chapter: e.target.value as ChapterId })
                  }
                >
                  {CHAPTERS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Learning question
                <input
                  maxLength={500}
                  value={scene.question ?? ""}
                  placeholder="What could our friend try?"
                  onChange={(e) => changeScene({ question: e.target.value })}
                />
              </label>
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
              {scene.script && <p className="field-hint">This scene uses numbered lines. Open Write My Episode Script to edit the words.</p>}
              <label>
                Narration
                <textarea
                  rows={4}
                  maxLength={6000}
                  readOnly={!!scene.script}
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
                  readOnly={!!scene.script}
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
      {overview && (
        <StoryOverview
          project={project}
          selected={index}
          onChange={updateProduction}
          onScene={(i) => {
            selectScene(i);
            setOverview(false);
            setMobilePanel("stage");
          }}
          onClose={() => setOverview(false)}
        />
      )}
      {reference && element && character && (
        <CharacterReference
          project={project}
          source={element}
          sceneId={scene.id}
          onChange={updateProduction}
          onLibrary={() => {
            setReference(false);
            onLibrary(index);
          }}
          onClose={() => setReference(false)}
        />
      )}
      {guide && (
        <CreatorGuide
          inEditor
          onClose={() => setGuide(false)}
          onStep={(step) => {
            setGuide(false);
            if (step === "art") onLibrary(index);
            else if (step === "scenes") setOverview(true);
            else if (step === "voice") openVoice(undefined, "narration");
            else if (step === "music") openVoice(undefined, "music", "sound");
            else if (step === "export") setFinish(true);
            else {
              setMobilePanel("stage");
              requestAnimationFrame(() =>
                document
                  .querySelector(
                    step === "animation" ? ".animation-studio" : ".stage-panel",
                  )
                  ?.scrollIntoView({ block: "start" }),
              );
            }
          }}
        />
      )}
      {voiceBoardOpen && !voiceStudio && !mouthStudio && !scriptOpen && !finish && (
        <LittleFixersVoiceBoard
          project={project}
          onClose={() => setVoiceBoardOpen(false)}
          onRecord={(sceneIndex, lineId) => {
            setVoiceBoardOpen(false);
            selectScene(sceneIndex);
            setScriptLine(lineId);
            setVoiceStudio({ lineId });
          }}
          onReview={(sceneIndex, lineId) => {
            setVoiceBoardOpen(false);
            selectScene(sceneIndex);
            setScriptLine(lineId);
            setScriptStep(undefined);
            setScriptOpen(true);
          }}
          onAnimate={(sceneIndex, clipId) => {
            setVoiceBoardOpen(false);
            selectScene(sceneIndex);
            setMouthStudio({ clipId });
          }}
          onCaptions={sceneIndex => {
            setVoiceBoardOpen(false);
            selectScene(sceneIndex);
            setVoiceStudio({ tab: "captions" });
          }}
        />
      )}
      {scriptOpen && !voiceStudio && !mouthStudio && !interactionEditor && !transformEditor && !focusEditor && !participationEditor && !soundDirector && !shotEditor && !storyCardsOpen && (
        <Suspense fallback={<Modal title="Write My Episode Script" onClose={() => setScriptOpen(false)}><p role="status">Opening the script…</p></Modal>}>
          <ScriptDirector project={project} index={index} selected={scriptLine}
            onSelect={setScriptLine} onSelectScene={selectScene} onChange={updateProduction} onScene={changeScene}
            onClose={() => { setScriptOpen(false); setScriptStep(undefined); }}
            onShot={lineId => { halt(); setShotEditor({ lineId }); }}
            onRecord={lineId => {
              halt();
              setScriptLine(lineId);
              setVoiceStudio({ lineId });
            }}
            onAnimateVoice={clipId => { halt(); setMouthStudio({ clipId }); }}
            onInteraction={() => { halt(); setInteractionEditor({ suggestion: interactionSuggestion(project, scene) }); }}
            onFocusStep={stepId => { halt(); setFocusEditor({ seed: { stepId } }); }}
            learningStepId={scriptStep}
            onParticipation={stepId => { halt(); setParticipationEditor({ stepId }); }}
            onTiming={clipId => openVoice(clipId)} onCaptions={() => openVoice(undefined, undefined, "captions")}
            onUndo={onUndo} onRedo={onRedo} canUndo={canUndo} canRedo={canRedo} saveStatus={saveStatus} saveError={saveError}
          />
        </Suspense>
      )}
      {interactionEditor && (
        <InteractionStudio project={project} scene={scene} selectedId={element?.id}
          current={scene.interactions?.find(item => item.id === interactionEditor.id)}
          suggestion={interactionEditor.suggestion}
          time={clamp(clock.getSnapshot().seconds - sceneStart(project, index), 0, scene.duration)}
          onClose={() => setInteractionEditor(undefined)} onApply={changeScene}
          onSound={(id, moment) => { setInteractionEditor(undefined); setSoundDirector({ anchor: { kind: "action", id, moment } }); }}
          onShowTransform={objectId => { setInteractionEditor(undefined); setTransformEditor({ objectId }); }} />
      )}
      {transformEditor && (
        <TransformStudio project={project} scene={scene} objectId={transformEditor.objectId} changeId={transformEditor.changeId}
          time={clamp(clock.getSnapshot().seconds - sceneStart(project, index), 0, scene.duration)}
          onClose={() => setTransformEditor(undefined)} onApply={changeScene}
          onFocus={(objectId, changeId) => { setTransformEditor(undefined); setFocusEditor({ seed: { objectId, changeId } }); }}
          onSound={id => { setTransformEditor(undefined); setSoundDirector({ anchor: { kind: "change", id } }); }} />
      )}
      {soundDirector && (
        <Suspense fallback={<Modal title={SOUND_DIRECTOR_TITLE} onClose={() => setSoundDirector(undefined)}>
          <p role="status">Opening Sound Director…</p>
        </Modal>}>
          <SoundDirector project={project} index={index} seed={soundDirector}
            time={clamp(clock.getSnapshot().seconds - sceneStart(project, index), 0, scene.duration)}
            onClose={() => setSoundDirector(undefined)}
            onApply={(next, nextIndex) => {
              const applied = updateProduction(next);
              if (applied && nextIndex !== index) selectScene(nextIndex);
              return applied;
            }}
            onVoices={clipId => { setSoundDirector(undefined); openVoice(clipId); }} />
        </Suspense>
      )}
      {storyCardsOpen && (
        <Suspense fallback={<Modal title={STORY_CARD_STUDIO} onClose={() => setStoryCardsOpen(false)}>
          <p role="status">Opening story cards…</p>
        </Modal>}>
          <StoryCardStudio project={project} selected={index} onClose={() => setStoryCardsOpen(false)}
            onApply={applyStoryCard} onScript={(next, i) => applyStoryCard(next, i, true)} />
        </Suspense>
      )}
      {shotEditor && (
        <Suspense fallback={<Modal title={SHOT_TITLE} onClose={() => setShotEditor(undefined)}>
          <p role="status">Opening camera director…</p>
        </Modal>}>
          <ShotDirector key={scene.id} project={project} scene={scene} id={shotEditor.id} lineId={shotEditor.lineId}
            initialPreset={shotEditor.preset} initialInspectTime={shotEditor.inspectAt}
            initialInspectKind={shotEditor.inspectKind}
            time={clamp(clock.getSnapshot().seconds - sceneStart(project, index), 0, scene.duration)}
            onScene={next => { selectScene(next); setShotEditor({}); }}
            onClose={() => setShotEditor(undefined)} onApply={changeScene} />
        </Suspense>
      )}
      {participationEditor && (
        <Suspense fallback={<Modal title={PARTICIPATION_TITLE} onClose={() => setParticipationEditor(undefined)}>
          <p role="status">Opening participation studio…</p>
        </Modal>}>
          <ParticipationStudio key={scene.id} project={project} scene={scene} id={participationEditor.id} stepId={participationEditor.stepId}
            time={clamp(clock.getSnapshot().seconds - sceneStart(project, index), 0, scene.duration)}
            onScene={next => { selectScene(next); setParticipationEditor({}); }}
            onClose={() => setParticipationEditor(undefined)}
            onSound={id => { setParticipationEditor(undefined); setSoundDirector({ anchor: { kind: "participation", id, moment: "reveal" } }); }}
            onApply={(patch, dedicated) => dedicated ? addScene(dedicated) : changeScene(patch)}
            onScript={(lineId, stepId) => {
              setParticipationEditor(undefined); setScriptLine(lineId ?? ""); setScriptStep(stepId); setScriptOpen(true);
            }} />
        </Suspense>
      )}
      {focusEditor && (
        <Suspense fallback={<Modal title={FOCUS_TITLE} onClose={() => setFocusEditor(undefined)}><p role="status">Opening teaching graphics…</p></Modal>}>
          <FocusStudio key={scene.id} project={project} scene={scene} graphicId={focusEditor.graphicId} seed={focusEditor.seed}
            time={clamp(clock.getSnapshot().seconds - sceneStart(project, index), 0, scene.duration)}
            onScene={next => { selectScene(next); setFocusEditor({}); }}
            onClose={() => setFocusEditor(undefined)} onApply={changeScene} />
        </Suspense>
      )}
      {mouthStudio && (
        <Suspense fallback={<Modal title="Make My Character Talk" onClose={() => setMouthStudio(undefined)}><p role="status">Opening the talking studio…</p></Modal>}>
          <VoiceMouthStudio project={project} index={index} initialClip={mouthStudio.clipId}
            onClose={() => setMouthStudio(undefined)}
            onApply={next => {
              validateProject(next);
              onChange(next);
              setMouthStudio(undefined);
            }}
            onPlay={() => {
              setMouthStudio(undefined);
              setScriptOpen(false);
              setScope("scene");
              seek(sceneStart(project, index));
              void play(false, true, "scene");
            }}
          />
        </Suspense>
      )}
      {voiceStudio && (
        <VoiceStudio
          project={project}
          sceneIndex={index}
          localTime={clamp(
            clock.getSnapshot().seconds - sceneStart(project, index),
            0,
            scene.duration,
          )}
          initialClip={voiceStudio.clipId}
          lineTarget={voiceStudio.lineId}
          initialCategory={voiceStudio.category}
          initialTab={voiceStudio.tab}
          onChange={updateProduction}
          onConvert={onConvert}
          onClose={() => setVoiceStudio(null)}
          onPreview={() => {
            setVoiceStudio(null);
            setScriptOpen(false);
            void play(false, true);
          }}
          saveStatus={saveStatus}
          saveError={saveError}
          onRetry={onRetry}
        />
      )}
      {finish && (
        <Suspense
          fallback={
            <Modal
              title="Preparing movie tools"
              onClose={() => setFinish(false)}
            >
              <p>Opening your local exporter…</p>
            </Modal>
          }
        >
          <FinishCartoon
            project={project}
            onStoryCards={() => { setFinish(false); setStoryCardsOpen(true); }}
            saveStatus={saveStatus}
            onScene={(i, reviewPanel, inspectAt, inspectKind) => {
              setFinish(false);
              selectScene(i);
              if (reviewPanel === "preview") {
                setScope("scene");
                setSound(true);
                setMobilePanel("stage");
                // The creator presses Play; we never autoplay or request media.
                requestAnimationFrame(() =>
                  document.querySelector(".stage-panel")
                    ?.scrollIntoView({ block: "start" }),
                );
                return;
              }
              if (reviewPanel === "camera-review") {
                // Open the exact scene's existing camera-shot editor, not a
                // Framefield-only preset. Start with the first saved shot
                // when available or a temporary draft for an empty scene.
                // The author still previews and explicitly applies edits.
                setShotEditor({
                  id: project.scenes[i].cameraShots?.[0]?.id,
                  inspectAt: inspectAt !== undefined && Number.isFinite(inspectAt)
                    ? clamp(inspectAt, 0, project.scenes[i].duration)
                    : undefined,
                  inspectKind: inspectAt !== undefined && Number.isFinite(inspectAt)
                    ? inspectKind : undefined,
                });
                setMobilePanel("stage");
                return;
              }
              if (reviewPanel === "camera" || reviewPanel === "camera-pan" ||
                  reviewPanel === "camera-tilt" || reviewPanel === "camera-glide" ||
                  reviewPanel === "camera-reveal") {
                setShotEditor({
                  preset: reviewPanel === "camera" ? "framefield-push" :
                    reviewPanel === "camera-pan" ? "framefield-pan" :
                    reviewPanel === "camera-tilt" ? "framefield-tilt" :
                    reviewPanel === "camera-glide" ? "framefield-glide" : "framefield-reveal",
                });
                setMobilePanel("stage");
                // The existing camera director previews before any Apply.
                return;
              }
              setMobilePanel("properties");
              if (reviewPanel)
                openVoice(
                  project.audioClips.find(
                    (c) =>
                      c.sceneId === project.scenes[i].id &&
                      ["narration", "dialogue"].includes(c.category),
                  )?.id ?? "",
                  undefined,
                  reviewPanel === "captions" ? "captions" : undefined,
                );
            }}
            onClose={() => setFinish(false)}
            onVoices={() => {
              setFinish(false);
              openVoice();
            }}
            onCaptions={() => {
              setFinish(false);
              openVoice(undefined, undefined, "captions");
            }}
            onPreview={(sound) => {
              setFinish(false);
              void play(true, sound);
            }}
          />
        </Suspense>
      )}
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
