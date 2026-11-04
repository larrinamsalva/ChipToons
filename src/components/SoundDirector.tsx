import { useMemo, useState } from "react";
import type { AudioAsset, AudioClip } from "../media-model";
import type { Project } from "../model";
import { ATMOSPHERES, atmosphereRange, soundAnchorKey } from "../sound-cues";
import type { AtmosphereId, SoundAnchor } from "../sound-cues";
import { originalSound, prepareSound, SOUND_DIRECTOR_TITLE, SOUND_LEVELS, soundMoments, soundNotes } from "../sound-director";
import type { SoundDraft } from "../sound-director";
import { SOUNDS } from "../sounds";
import type { SoundId } from "../sounds";
import { sceneStart } from "../timeline";
import { MediaNumber } from "./MediaNumber";
import { Modal } from "./Modal";
import { ScenePreview } from "./ScenePreview";

export type SoundDirectorSeed = { anchor?: SoundAnchor; atmosphere?: boolean; clipId?: string };
type Mode = "effects" | "atmosphere";
type Draft = Omit<SoundDraft, "asset"> & { asset?: AudioAsset; source: string };

export function SoundDirector({ project, index, time, seed, onClose, onApply, onVoices }: {
  project: Project; index: number; time: number; seed: SoundDirectorSeed; onClose: () => void;
  onApply: (project: Project, index: number) => boolean; onVoices: (clipId?: string) => void;
}) {
  const original = project.audioClips.find(clip => clip.id === seed.clipId);
  const [sceneIndex, setSceneIndex] = useState(index);
  const [mode, setMode] = useState<Mode>(seed.atmosphere || original?.ambience ? "atmosphere" : "effects");
  const scene = project.scenes[sceneIndex];
  const events = useMemo(() => soundMoments(project, scene), [project, scene]);
  const [draft, setDraft] = useState<Draft>(() => original ? editDraft(original) : emptyDraft(index, mode, seed.anchor));
  const [preview, setPreview] = useState<ReturnType<typeof prepareSound> & { sourceProject: Project }>();
  const [error, setError] = useState("");
  const [preset, setPreset] = useState<AtmosphereId | "">(scene.suggestedAtmosphere ?? "");
  const [remove, setRemove] = useState(false);
  const chosen = events.find(event => draft.anchor && soundAnchorKey(event.anchor) === soundAnchorKey(draft.anchor));
  const review = project.audioClips.find(clip => clip.id === draft.clipId)?.soundReview;
  const range = draft.ambience && atmosphereRange(project.scenes, draft.ambience);
  const placement = preview?.clip.start ?? (range?.start ?? (chosen ? chosen.at + draft.offset : draft.at));
  const displayedDuration = preview?.clip.duration ?? range?.duration ?? draft.duration;
  const sceneOffset = sceneStart(project, sceneIndex);
  const existing = project.audioClips.filter(clip => mode === "effects" ? clip.category === "effects" && clip.sceneId === scene.id :
    !!clip.ambience && clip.start < sceneOffset + scene.duration && clip.start + clip.duration > sceneOffset);
  const savedClips = draft.clipId && !existing.some(clip => clip.id === draft.clipId) && original ? [...existing, original] : existing;
  const warnings = preview ? soundNotes(preview.project).filter(note =>
    note.id.endsWith(preview.clip.id) || note.id.startsWith("sound-voice:")).slice(0, 5) : [];
  const maxDuration = Math.min(scene.duration, draft.asset?.duration ?? scene.duration);
  const previewIndex = preview && range && (range.start >= sceneOffset + scene.duration || range.start + range.duration <= sceneOffset)
    ? project.scenes.findIndex(item => item.id === draft.ambience?.first) : sceneIndex;
  const previewScene = project.scenes[previewIndex];
  const previewOffset = sceneStart(project, previewIndex);
  const previewFrom = preview ? Math.max(0, Math.min(previewScene.duration - 0.02,
    mode === "atmosphere" ? preview.clip.start - previewOffset : preview.clip.start - 0.35)) : 0;
  const canPreview = !!draft.asset && (mode === "effects" || !!range);

  function emptyDraft(nextIndex: number, nextMode: Mode, anchor?: SoundAnchor): Draft {
    const nextScene = project.scenes[nextIndex];
    return { source: "", at: nextIndex === index ? Math.min(time, nextScene.duration - 0.01) : 0,
      offset: 0, anchor, duration: 1, volume: nextMode === "atmosphere" ? 0.22 : SOUND_LEVELS.story.volume,
      fadeIn: nextMode === "atmosphere" ? 0.55 : 0.03, fadeOut: nextMode === "atmosphere" ? 0.75 : 0.08,
      ambience: nextMode === "atmosphere" ? { first: nextScene.id, last: nextScene.id } : undefined,
    };
  }
  function editDraft(clip: AudioClip): Draft {
    return { clipId: clip.id, source: `asset:${clip.assetId}`, asset: project.audioAssets.find(item => item.id === clip.assetId),
      anchor: clip.soundCue?.anchor, offset: clip.soundCue?.offset ?? 0, at: clip.start, duration: clip.duration,
      volume: clip.volume, fadeIn: clip.fadeIn, fadeOut: clip.fadeOut, ambience: clip.ambience ?? (seed.atmosphere ? { first: scene.id, last: scene.id } : undefined), muted: clip.muted };
  }
  function patch(values: Partial<Draft>) {
    setDraft(item => ({ ...item, ...values }));
    setPreview(undefined); setError(""); setRemove(false);
  }
  function chooseSource(source: string, suggestedDuration?: number) {
    const asset = source.startsWith("original:") ? originalSound(project, source.slice(9) as SoundId) :
      project.audioAssets.find(item => `asset:${item.id}` === source);
    patch({ source, asset, duration: asset ? Math.min(asset.duration, suggestedDuration ?? asset.duration, scene.duration) : 1 });
  }
  function reset(nextIndex: number, nextMode: Mode) {
    setSceneIndex(nextIndex); setMode(nextMode); setDraft(emptyDraft(nextIndex, nextMode));
    setPreset(project.scenes[nextIndex].suggestedAtmosphere ?? "");
    setPreview(undefined); setError(""); setRemove(false);
  }
  function reviewDraft() {
    if (!draft.asset) return;
    try {
      setPreview({ ...prepareSound(project, sceneIndex, { ...draft, asset: draft.asset }), sourceProject: project });
      setError("");
    } catch (error) {
      setPreview(undefined); setError(error instanceof Error ? error.message : "This sound could not be prepared.");
    }
  }
  function apply() {
    if (!preview) return;
    if (preview.sourceProject !== project) {
      setPreview(undefined); setError("The project changed. Preview this sound again before applying."); return;
    }
    if (onApply(preview.project, sceneIndex)) onClose();
    else setError("This sound could not be applied. Review the current project limits.");
  }

  return <Modal title={SOUND_DIRECTOR_TITLE} onClose={onClose} wide>
    <p className="field-hint">Link a sound to a saved action or let a quiet atmosphere carry across scenes. Preview the real mix before applying.</p>
    <div className="interaction-layout sound-director">
      <div className="interaction-controls">
        <label>Choose a scene<select aria-label="Choose a scene" value={sceneIndex} onChange={event => reset(Number(event.target.value), mode)}>
          {project.scenes.map((item, i) => <option key={item.id} value={i}>{i + 1}. {item.title}</option>)}
        </select></label>
        <label>What would you like to add?<select aria-label="What would you like to add?" value={mode}
          onChange={event => reset(sceneIndex, event.target.value as Mode)}>
          <option value="effects">Sound for an action</option><option value="atmosphere">Location atmosphere</option>
        </select></label>
        {!!savedClips.length && <label>Saved sound<select aria-label="Saved sound" value={draft.clipId ?? ""} onChange={event => {
          const clip = savedClips.find(item => item.id === event.target.value);
          setDraft(clip ? editDraft(clip) : emptyDraft(sceneIndex, mode));
          setPreview(undefined); setError(""); setRemove(false);
        }}>
          <option value="">Add a new sound</option>
          {savedClips.map(clip => <option key={clip.id} value={clip.id}>{clip.name} · {clip.start.toFixed(2)} s</option>)}
        </select></label>}
        {review && <p className="interaction-empty" role="status">This sound’s event or scene range changed. The original is still available. Choose a new event or review the saved placement.</p>}
        {mode === "effects" ? <>
          <label>What happens in the scene?<select aria-label="What happens in the scene?" value={draft.anchor ? soundAnchorKey(draft.anchor) : ""}
            onChange={event => {
              const next = events.find(item => soundAnchorKey(item.anchor) === event.target.value);
              patch({ anchor: next?.anchor, at: next?.at ?? draft.at, offset: 0 });
            }}>
            <option value="">Place the sound by scene time</option>
            {events.map(item => <option key={soundAnchorKey(item.anchor)} value={soundAnchorKey(item.anchor)}>
              {item.at.toFixed(2)} s · {item.label.slice(0, 100)}
            </option>)}
          </select></label>
          {chosen?.suggested && <button type="button" className="button secondary small"
            onClick={() => chooseSource(`original:${chosen.suggested}`, chosen.duration)}>
            Use suggested sound · {SOUNDS.find(item => item[0] === chosen.suggested)?.[1]}
          </button>}
          {chosen ? <MediaNumber label="Offset from action (seconds)" value={draft.offset} min={-10} max={10}
            onChange={offset => patch({ offset })} /> :
            <MediaNumber label="Start in this scene (seconds)" value={draft.at} max={scene.duration - 0.01}
              onChange={at => patch({ at })} />}
        </> : <>
          <label>Suggested location atmosphere<select aria-label="Suggested location atmosphere" value={preset}
            onChange={event => setPreset(event.target.value as AtmosphereId | "")}>
            <option value="">Choose a preset</option>
            {Object.entries(ATMOSPHERES).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}
          </select></label>
          {preset && <button type="button" className="button secondary small" onClick={() => chooseSource(`original:${ATMOSPHERES[preset].sound}`)}>
            Use this atmosphere
          </button>}
          <label>Start atmosphere in<select aria-label="Start atmosphere in" value={draft.ambience?.first} onChange={event => {
            const first = event.target.value;
            const last = project.scenes.findIndex(item => item.id === draft.ambience?.last) >=
              project.scenes.findIndex(item => item.id === first) ? draft.ambience!.last : first;
            patch({ ambience: { first, last } });
          }}>{project.scenes.map((item, i) => <option key={item.id} value={item.id}>{i + 1}. {item.title}</option>)}</select></label>
          <label>Continue atmosphere through<select aria-label="Continue atmosphere through" value={draft.ambience?.last}
            onChange={event => patch({ ambience: { first: draft.ambience?.first ?? scene.id, last: event.target.value } })}>
            {project.scenes.map((item, i) => i >= project.scenes.findIndex(first => first.id === draft.ambience?.first)
              ? <option key={item.id} value={item.id}>{i + 1}. {item.title}</option> : null)}
          </select></label>
          <p className="field-hint">One loop continues across the chosen scenes. Set a fade out below, or choose another sound to replace it.</p>
        </>}
        <label>Choose a sound<select aria-label="Choose a sound" value={draft.source} onChange={event => chooseSource(event.target.value)}>
          <option value="">Choose an original or saved sound</option>
          <optgroup label="Original ChipToons sounds">
            {SOUNDS.map(([id, name]) => <option key={id} value={`original:${id}`}>{name}</option>)}
          </optgroup>
          {!!project.audioAssets.length && <optgroup label="Sounds already in this project">
            {project.audioAssets.map(asset => <option key={asset.id} value={`asset:${asset.id}`}>{asset.name}</option>)}
          </optgroup>}
        </select></label>
        <label>Sound level preset<select aria-label="Sound level preset"
          value={Object.entries(SOUND_LEVELS).find(([, item]) => item.volume === draft.volume)?.[0] ?? ""}
          onChange={event => {
            const level = SOUND_LEVELS[event.target.value as keyof typeof SOUND_LEVELS];
            if (level) patch({ volume: level.volume });
          }}>
          <option value="">Custom level</option>
          {Object.entries(SOUND_LEVELS).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}
        </select></label>
        <fieldset className="interaction-fields">
          <legend>Timing and loudness</legend>
          {mode === "effects" && <MediaNumber label="Sound duration (seconds)" min={0.01} max={maxDuration}
            value={draft.duration} onChange={duration => patch({ duration })} />}
          <MediaNumber label="Sound volume (%)" min={0} max={100} step={1} value={draft.volume * 100}
            onChange={volume => patch({ volume: volume / 100 })} />
          <MediaNumber label="Fade in (seconds)" min={0} max={Math.max(1, displayedDuration)} value={draft.fadeIn}
            onChange={fadeIn => patch({ fadeIn })} />
          <MediaNumber label="Fade out (seconds)" min={0} max={Math.max(1, displayedDuration)} value={draft.fadeOut}
            onChange={fadeOut => patch({ fadeOut })} />
        </fieldset>
        <label className="world-check"><input type="checkbox" checked={draft.muted ?? false}
          onChange={event => patch({ muted: event.target.checked })} /> Mute this sound</label>
        <button className="button secondary small" onClick={() => onVoices(draft.clipId)}>Open Voices &amp; Sound for imports and advanced edits</button>
      </div>
      <div className="interaction-review">
        <dl className="sound-review-summary">
          <div><dt>Scene</dt><dd>{scene.title}</dd></div>
          <div><dt>Moment</dt><dd>{chosen?.label ?? (mode === "atmosphere" ? "Across the chosen scenes" : "Scene time")}</dd></div>
          <div><dt>Sound</dt><dd>{draft.asset?.name ?? "Choose a sound"}</dd></div>
          <div><dt>Timing</dt><dd>{placement.toFixed(2)} s {mode === "atmosphere" ? "into episode" : "into scene"} · {displayedDuration.toFixed(2)} s long</dd></div>
          <div><dt>Mix</dt><dd>{Math.round(draft.volume * 100)}% · fades {draft.fadeIn.toFixed(2)} / {draft.fadeOut.toFixed(2)} s</dd></div>
        </dl>
        <button className="button secondary" disabled={!canPreview} onClick={reviewDraft}>Preview sound with animation</button>
        {error && <p role="alert" className="interaction-empty">{error}</p>}
        {preview && <>
          <p role="status">Ready to apply after listening.</p>
          {!!warnings.length && <ul aria-label="Sound review notes" className="participation-warnings">
            {warnings.map(note => <li key={note.id}><strong>{note.title}.</strong> {note.detail}</li>)}
          </ul>}
          <ScenePreview key={preview.clip.id + preview.clip.start} project={preview.project} scene={previewScene}
            initialTime={previewFrom} playFrom={previewFrom}
            precision={2} showCaptions soundPreview initialSound />
        </>}
      </div>
    </div>
    {remove && <div className="interaction-confirm" role="group" aria-label="Remove sound">
      <p>Remove this clip from the timeline? Its original stays in Voices &amp; Sound.</p>
      <button className="button secondary" onClick={() => setRemove(false)}>Keep sound</button>
      <button className="button danger" onClick={() => {
        const next = { ...project, audioClips: project.audioClips.filter(clip => clip.id !== draft.clipId) };
        if (onApply(next, sceneIndex)) onClose();
      }}>Remove clip</button>
    </div>}
    <div className="modal-actions">
      {draft.clipId && !remove && <button className="button text" onClick={() => setRemove(true)}>Remove saved sound</button>}
      <button className="button secondary" onClick={onClose}>Cancel</button>
      <button className="button primary" disabled={!preview} onClick={apply}>Apply</button>
    </div>
  </Modal>;
}
