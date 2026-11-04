import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { missingAudio } from "../audio-vault";
import { AudioDecodeCache, PreviewAudio } from "../audio-engine";
import { EMOTIONS } from "../animation-model";
import type { Project, Scene } from "../model";
import type { AudioClip } from "../media-model";
import { PlaybackClock } from "../playback";
import { clamp, sceneStart } from "../timeline";
import {
  analyzeVoiceEnvelope, applyTalkingPreset, hasManualMouth, mouthTrackIsCurrent,
  supportsVoiceMouth, voiceClips, voiceRange, withVoiceTrack,
} from "../voice-mouth";
import { MAX_MOUTH_CORRECTIONS, MAX_MOUTH_TRACKS, TALKING_PRESETS } from "../voice-mouth-model";
import type { TalkingPreset, VoiceMouthTrack } from "../voice-mouth-model";
import { MediaNumber } from "./MediaNumber";
import { Modal } from "./Modal";
import { Stage } from "./Stage";

function Comparison({ project, proposed, scene, clip, start, clock, audio, busy }: {
  project: Project; proposed: Project; scene: Scene; clip?: AudioClip; start: number;
  clock: PlaybackClock; audio: PreviewAudio; busy: boolean;
}) {
  const frame = useSyncExternalStore(clock.subscribe, clock.getSnapshot);
  const [error, setError] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [calm, setCalm] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const time = clamp(frame.seconds - start, 0, scene.duration);
  const end = start + scene.duration;
  const updatedScene = proposed.scenes.find(item => item.id === scene.id) ?? scene;
  const range = clip && voiceRange(project, scene, clip);
  const clipFrom = range ? range.clipStart + range.from : start;
  const clipTo = range ? range.clipStart + range.to : end;

  function pause() {
    clock.pause();
    clock.setTimeSource();
    audio.stop();
  }

  function seek(local: number) {
    pause();
    clock.configure(start, end, false);
    clock.seek(start + local);
  }

  async function play() {
    if (frame.playing) { pause(); return; }
    const from = frame.seconds >= clipFrom && frame.seconds < clipTo ? frame.seconds : clipFrom;
    seek(from - start);
    clock.configure(clipFrom, clipTo, false);
    setPreparing(true);
    setError("");
    try {
      const source = clip && !clip.muted
        ? await audio.start({ ...project, audioClips: [clip] }, from, clipFrom, clipTo, false, problem => {
          pause();
          setError(problem.message);
        }) : undefined;
      clock.setTimeSource(source);
      clock.play();
    } catch (problem) {
      if (!(problem instanceof DOMException && problem.name === "AbortError"))
        setError(problem instanceof Error ? problem.message : "Preview could not play.");
    } finally { setPreparing(false); }
  }

  return <section className="voice-mouth-card" aria-label="Mouth animation comparison">
    <div className="voice-mouth-comparison">
      <figure><figcaption>Current animation</figcaption><Stage project={project} scene={scene} time={time} labelled={false} calmPreview={calm} /></figure>
      <figure><figcaption>Proposed animation</figcaption><Stage project={proposed} scene={updatedScene} time={time} labelled={false} calmPreview={calm} /></figure>
    </div>
    <div className="voice-mouth-actions">
      <button className="button secondary" disabled={busy || preparing || !range} onClick={() => void play()}>
        {frame.playing ? "Pause comparison" : preparing ? "Preparing comparison…" : "Play comparison with sound"}
      </button>
      <label className="inline-check"><input type="checkbox" checked={calm} onChange={event => setCalm(event.target.checked)} />
        Reduced motion preview
      </label>
    </div>
    <label>Scene playhead<input type="range" min={0} max={scene.duration} step={0.02} value={time}
      disabled={preparing} onChange={event => seek(Number(event.target.value))} /></label>
    {!frame.playing && !preparing && <MediaNumber label="Preview scene time (seconds)" value={time} max={scene.duration} onChange={seek} />}
    {error && <p role="alert">{error}</p>}
  </section>;
}

export function VoiceMouthStudio({ project, index, initialClip, onApply, onClose, onPlay }: {
  project: Project; index: number; initialClip?: string;
  onApply: (next: Project) => void; onClose: () => void; onPlay: () => void;
}) {
  const scene = project.scenes[index];
  const start = sceneStart(project, index);
  const available = voiceClips(project, scene);
  const [clipId, setClipId] = useState(initialClip ?? "");
  const clip = available.find(item => item.id === clipId);
  const [actorId, setActorId] = useState(() => {
    const assigned = available.find(item => item.id === initialClip)?.characterId;
    return assigned ? scene.elements.find(item => item.characterId === assigned)?.id ?? "" : "";
  });
  const [manualActor, setManualActor] = useState(false);
  const asset = project.audioAssets.find(item => item.id === clip?.assetId);
  const [missingAssetId, setMissingAssetId] = useState("");
  useEffect(() => {
    if (!asset?.file) return;
    let active = true;
    void missingAudio({ audioAssets: [asset] }).then(missing => {
      if (active) setMissingAssetId(missing[0] ?? "");
    }).catch(() => {
      if (active) setMissingAssetId(asset.id);
    });
    return () => { active = false; };
  }, [asset]);
  const missing = !!asset?.file && missingAssetId === asset.id;
  const actor = scene.elements.find(item => item.id === actorId);
  const character = project.characters.find(item => item.id === actor?.characterId);
  const supported = !!actor && supportsVoiceMouth(character, actor);
  const saved = actor?.voiceMouth?.find(item => item.clipId === clipId);
  const [pending, setPending] = useState<{ clipId: string; actorId: string; track?: VoiceMouthTrack }>();
  const draft = pending?.clipId === clipId && pending.actorId === actorId ? pending.track : saved;
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [pauseLength, setPauseLength] = useState(0.35);
  const [correction, setCorrection] = useState(0.35);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [clock] = useState(() => {
    const clock = new PlaybackClock();
    clock.configure(start, start + scene.duration, false);
    clock.seek(start);
    return clock;
  });
  const [audio] = useState(() => new PreviewAudio());
  const [analysisCache] = useState(() => new AudioDecodeCache(16 * 1024 * 1024));
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const unsubscribe = clock.subscribe(() => {
      if (!clock.getSnapshot().playing) { audio.stop(); clock.setTimeSource(); }
    });
    return () => {
      alive.current = false;
      unsubscribe();
      clock.dispose();
      audio.dispose();
      analysisCache.clear();
    };
  }, [clock, audio, analysisCache]);
  const range = clip && voiceRange(project, scene, clip);
  const stale = !!(actor && draft && (missing || !mouthTrackIsCurrent(project, scene, actor, draft)));
  const manual = !!(actor && draft && range && hasManualMouth(actor,
    range.clipStart + Math.max(range.from, draft.start) - start,
    range.clipStart + Math.min(range.to, draft.end) - start));
  const hasRoom = !!saved || (actor?.voiceMouth?.length ?? 0) < MAX_MOUTH_TRACKS;
  const canApply = !!(hasRoom && supported && draft && !stale && (!manual || !draft.replaceManual || confirmed));
  const proposed = actor && draft && supported && hasRoom && !stale
    ? withVoiceTrack(project, scene, actor, clipId, draft) : project;
  const options = scene.elements.filter(item => project.characters.some(character => character.id === item.characterId));
  const oldClips = new Set(scene.elements.flatMap(item => item.voiceMouth?.map(track => track.clipId) ?? []));
  const unavailable = [...oldClips].filter(id => !available.some(clip => clip.id === id));
  const conflicting = !!(clip?.characterId && actor && actor.characterId !== clip.characterId);

  function pause() {
    clock.pause();
    clock.setTimeSource();
    audio.stop();
  }

  function seekLocal(seconds: number) {
    pause();
    clock.configure(start, start + scene.duration, false);
    clock.seek(start + seconds);
  }

  function changeSelection(nextActor: string, nextClip: string) {
    seekLocal(0);
    setActorId(nextActor);
    setClipId(nextClip);
    setPending(undefined);
    setConfirmed(false);
    setNotice("");
    setError("");
  }

  function setDraft(track?: VoiceMouthTrack) {
    setPending({ clipId, actorId, track });
  }

  function patch(settings: Partial<VoiceMouthTrack>) {
    if (draft) setDraft({ ...draft, ...settings });
  }

  async function analyze() {
    if (!clip || !actor || !supported || !range || busy || conflicting || !hasRoom) return;
    const source = asset;
    if (!source) { setError("This original recording is missing. Open Recovery Center to restore it."); return; }
    pause();
    setBusy(true);
    setError("");
    setNotice("");
    let context: AudioContext | undefined;
    try {
      if (typeof AudioContext === "undefined") throw new Error("This browser cannot decode voice audio.");
      context = new AudioContext({ sampleRate: 16000 });
      const buffer = await analysisCache.get(context, source);
      if (!alive.current) return;
      const levels = analyzeVoiceEnvelope(buffer, clip.trimStart, clip.trimEnd);
      if (!levels || !/[1-9a-f]/.test(levels))
        setNotice("This trim is silent or too quiet. The suggestion keeps the mouth closed.");
      const track = applyTalkingPreset({
        clipId: clip.id, sourceId: source.id, speakerId: actor.characterId,
        trimStart: clip.trimStart, trimEnd: clip.trimEnd, levels,
        start: range.from, end: range.to, delay: 0, preset: "normal",
        sensitivity: 1, minimum: 0.08, maximum: 0.82, expression: "keep",
        replaceManual: false, corrections: [],
      }, "normal");
      setDraft(track);
      setConfirmed(false);
      seekLocal(Math.max(0, range.clipStart + range.from - start));
    } catch (problem) {
      if (alive.current) setError(problem instanceof Error ? problem.message : "Could not analyze this recording.");
    } finally {
      if (alive.current) setBusy(false);
      void context?.close().catch(() => {});
    }
  }

  function correct(opening: number, length: number) {
    if (!draft || !range) return;
    const at = clock.getSnapshot().seconds - range.clipStart;
    const end = Math.min(at + length, draft.end, range.to);
    if (at < Math.max(draft.start, range.from) - 0.0001 || end - at < 0.01) {
      setError("Move the scene playhead inside the selected voice range before adding a correction.");
      return;
    }
    if (draft.corrections.length >= MAX_MOUTH_CORRECTIONS) {
      setError("This suggestion already has 32 corrections. Remove one to add another.");
      return;
    }
    patch({ corrections: [...draft.corrections, { start: Math.max(0, at), end, opening }] });
    setError("");
  }

  function save(remove = false) {
    if (!actor || (!remove && !canApply)) return;
    try {
      onApply(withVoiceTrack(project, scene, actor, clipId, remove ? undefined : draft));
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not save the mouth animation.");
    }
  }

  return <Modal title="Make My Character Talk" onClose={onClose} wide>
    <div className="voice-mouth-studio">
      <p>Match the character’s mouth to the loudness of a recording. This gives an approximate talking rhythm, without recognizing words or speech sounds.</p>
      <p><strong>Scene {index + 1} · {scene.title}</strong></p>
      {error && <p role="alert" className="media-notice">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <fieldset className="voice-mouth-fields" disabled={busy}>
        <legend className="visually-hidden">Voice and mouth settings</legend>
        <div className="form-grid">
          <label>Talking character<select value={actorId} onChange={event => { setManualActor(true); changeSelection(event.target.value, clipId); }}>
            <option value="">Choose a character on stage</option>
            {options.map((item, i) => <option key={item.id} value={item.id}>
              {project.characters.find(character => character.id === item.characterId)?.name} · Character {i + 1}
            </option>)}
          </select></label>
          <label>Recorded voice<select value={clipId} onChange={event => {
            const id = event.target.value, chosen = available.find(item => item.id === id);
            const assigned = chosen?.characterId;
            const match = assigned
              ? actor?.characterId === assigned ? actor : options.find(item => item.characterId === assigned)
              : manualActor ? actor : undefined;
            if (match?.id !== actorId) setManualActor(false);
            changeSelection(match?.id ?? "", id);
          }}>
            <option value="">Choose a recording</option>
            {available.map(item => <option key={item.id} value={item.id}>{item.name} · {item.category}{item.muted ? " · muted" : ""}</option>)}
            {unavailable.map((id, i) => <option key={id} value={id}>Earlier recording {i + 1} · no longer in this scene</option>)}
          </select></label>
        </div>
        {!available.length && <p>There are no overlapping narration or dialogue clips. Add one in Voices &amp; Sound or record a line in Script Director.</p>}
        {actor && !supported && <p className="media-notice">This character needs a drawn mouth part or a Puppet Maker face overlay. You can use existing whole-image motion from the Animation Timeline.</p>}
        {conflicting && <p className="media-notice">This dialogue is assigned to a different character. Choose its assigned character or edit the voice assignment in Voices &amp; Sound.</p>}
        {clip?.muted && <p>This clip is muted. Its voice-driven mouth stays closed until it is unmuted.</p>}
        {!hasRoom && <p>Remove a saved voice track before adding another to this character.</p>}
        {missing && <p role="alert">The original recording is unavailable. Try restoring it in Recovery Center.</p>}
        {stale && <p className="media-notice">Needs timing review. The clip, original or trim changed. Analyze the current recording before applying.</p>}
        <button className="button primary" disabled={!supported || !clip || conflicting || !hasRoom || missing} onClick={() => void analyze()}>
          {busy ? "Analyzing recording…" : draft ? "Analyze recording again" : "Analyze recording"}
        </button>
        {draft && range && !stale && <section className="voice-mouth-card" aria-label="Suggested mouth animation">
          <p role="status">{draft === saved ? "Applied" : "Mouth animation suggested"}</p>
          <div className="form-grid">
            <label>Talking style<select value={draft.preset} onChange={event => setDraft(applyTalkingPreset(draft, event.target.value as TalkingPreset))}>
              {Object.entries(TALKING_PRESETS).map(([id, preset]) => <option key={id} value={id}>{preset.label}</option>)}
            </select></label>
            <label>Expression during talking<select value={draft.expression} onChange={event => patch({ expression: event.target.value as VoiceMouthTrack["expression"] })}>
              <option value="keep">Keep the current expression</option>
              {EMOTIONS.map(emotion => <option key={emotion} value={emotion}>{emotion}</option>)}
            </select></label>
            <MediaNumber label="Sensitivity" min={0.25} max={2.5} value={draft.sensitivity} onChange={sensitivity => patch({ sensitivity })} />
            <MediaNumber label="Maximum opening" min={draft.minimum} max={1} value={draft.maximum} onChange={maximum => patch({ maximum })} />
          </div>
          <details>
            <summary>Timing range and fine adjustments</summary>
            <p>Range and corrections use seconds from the start of this clip. The playhead below uses scene time.</p>
            <div className="form-grid">
              <MediaNumber label="Start in clip (seconds)" min={range.from} max={Math.min(range.to, draft.end) - 0.01}
                value={Math.max(range.from, draft.start)} onChange={start => patch({ start })} />
              <MediaNumber label="End in clip (seconds)" min={Math.max(range.from, draft.start) + 0.01} max={range.to}
                value={Math.min(range.to, draft.end)} onChange={end => patch({ end })} />
              <MediaNumber label="Mouth timing offset (seconds)" min={-0.5} max={0.5} value={draft.delay} onChange={delay => patch({ delay })} />
              <MediaNumber label="Minimum speaking opening" max={draft.maximum} value={draft.minimum} onChange={minimum => patch({ minimum })} />
            </div>
          </details>
          {manual && <div className="media-notice">
            <p>Manual mouth keys overlap this range. By default the suggestion uses only intervals without manual mouth states.</p>
            <label>Manual mouth keys<select value={draft.replaceManual ? "replace" : "unused"}
              onChange={event => { patch({ replaceManual: event.target.value === "replace" }); setConfirmed(false); }}>
              <option value="unused">Keep manual keys and use unused intervals</option>
              <option value="replace">Override mouth movement in this range</option>
            </select></label>
            {draft.replaceManual && <label className="inline-check"><input type="checkbox" checked={confirmed}
              onChange={event => setConfirmed(event.target.checked)} />Confirm override of mouth movement only</label>}
          </div>}
        </section>}
      </fieldset>
      <Comparison key={clipId} project={project} proposed={proposed} scene={scene} clip={clip}
        start={start} clock={clock} audio={audio} busy={busy} />
      {draft && range && !stale && <details className="voice-mouth-card">
        <summary>Correct the mouth at the playhead</summary>
        <p>Move the playhead to the moment you want to change. Corrections affect only the mouth animation.</p>
        <div className="form-grid">
          <MediaNumber label="Pause length (seconds)" min={0.04} max={5} value={pauseLength} onChange={setPauseLength} />
          <MediaNumber label="Corrected opening" max={1} value={correction} onChange={setCorrection} />
        </div>
        <div className="voice-mouth-actions">
          <button className="button secondary" onClick={() => correct(0, 0.1)}>Close mouth here</button>
          <button className="button secondary" onClick={() => correct(0, pauseLength)}>Add a pause</button>
          <button className="button secondary" onClick={() => correct(correction, 0.12)}>Set mouth opening here</button>
          <button className="button secondary" disabled={!draft.corrections.length}
            onClick={() => patch({ corrections: draft.corrections.slice(0, -1) })}>Undo last correction</button>
          <button className="button secondary" onClick={() => {
            setDraft(applyTalkingPreset({ ...draft, start: range.from, end: range.to, delay: 0,
              expression: "keep", replaceManual: false, corrections: [] }, "normal"));
            setConfirmed(false);
            setError("");
          }}>Reset to original suggestion</button>
        </div>
        <p role="status">{draft.corrections.length} corrections</p>
      </details>}
      <div className="voice-mouth-actions">
        <button className="button primary" disabled={!canApply || busy} onClick={() => save()}>Apply mouth animation</button>
        {saved && <button className="button secondary" disabled={busy} onClick={() => save(true)}>Remove saved mouth animation</button>}
        <button className="button secondary" onClick={onClose}>Cancel</button>
        <button className="button secondary" disabled={busy} onClick={onPlay}>Play scene with saved animation</button>
      </div>
    </div>
  </Modal>;
}
