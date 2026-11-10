import { useMemo, useState } from "react";
import { hasCameraTrack, MAX_CAMERA_SHOTS, SHOT_STYLES, SHOT_TITLE, shotIssue, shotNeedsReview } from "../camera-shots";
import type { CameraShot, ShotStyle } from "../camera-shots";
import { elementName } from "../library";
import { uid } from "../model";
import type { Project, Scene } from "../model";
import { newCameraShot, shotAnchorKey, shotCueChoices, shotGap, shotPreset, subjectsOutside } from "../shot-director";
import {
  canStartFramefieldCinematicPush, framefieldGentleCinematicPush,
  framefieldGentleCinematicPan, framefieldCinematicPanFrame,
  framefieldGentleCinematicReveal,
} from "../framefield-cinematic-push";
import type { FramefieldPanDirection } from "../framefield-cinematic-push";
import { clamp, roundTime, sceneFramesAt, shotFraming } from "../timeline";
import { MediaNumber } from "./MediaNumber";
import { Modal } from "./Modal";
import { ScenePreview } from "./ScenePreview";
import { Stage } from "./Stage";

export function ShotDirector({ project, scene, time, id, lineId, initialPreset, onScene, onClose, onApply }: {
  project: Project; scene: Scene; time: number; id?: string; lineId?: string;
  initialPreset?: "framefield-push" | "framefield-pan" | "framefield-reveal";
  onScene: (index: number) => void; onClose: () => void; onApply: (patch: Partial<Scene>) => boolean;
}) {
  const saved = scene.cameraShots ?? [];
  const [draft, setDraft] = useState(() =>
    saved.find(shot => id ? shot.id === id : lineId && shot.lineId === lineId) ??
    (initialPreset === "framefield-push" && canStartFramefieldCinematicPush(project, scene)
      ? framefieldGentleCinematicPush(project, scene)
      : initialPreset === "framefield-pan" && canStartFramefieldCinematicPush(project, scene)
        ? framefieldGentleCinematicPan(project, scene, "left")
        : initialPreset === "framefield-reveal" && canStartFramefieldCinematicPush(project, scene)
          ? framefieldGentleCinematicReveal(project, scene)
          : newCameraShot(project, scene, time, lineId)));
  const [review, setReview] = useState(0);
  const [mode, setMode] = useState<"shot" | "sequence">("shot");
  const [compare, setCompare] = useState(false);
  const [guides, setGuides] = useState(true);
  const [thumbnails, setThumbnails] = useState(false);
  const [remove, setRemove] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [pendingScene, setPendingScene] = useState<number>();
  const editing = saved.some(shot => shot.id === draft.id);
  const others = saved.filter(shot => shot.id !== draft.id);
  const list = [...saved].sort((a, b) => a.start - b.start);
  const planned = { ...scene, cameraShots: [...others, draft].sort((a, b) => a.start - b.start) };
  const issue = shotIssue(planned.cameraShots, planned);
  const warning = shotNeedsReview(scene, draft);
  const conflict = hasCameraTrack(scene);
  const cues = useMemo(() => shotCueChoices(project, scene), [project, scene]);
  const cue = cues.find(item => draft.cue && shotAnchorKey(item.anchor) === shotAnchorKey(draft.cue.anchor));
  const previewScene = compare ? scene : planned;
  const span = draft.end - draft.start;
  const previewTime = Math.min(draft.end - span / 20, draft.start + Math.max(span / 3, draft.move));
  const subject = (shot: CameraShot) => shot.targets.map(id => {
    const element = scene.elements.find(item => item.id === id);
    return element ? elementName(project, element) : "Removed subject";
  }).join(" & ") || "Fixed frame";

  function patch(change: Partial<CameraShot>) {
    setDraft(value => {
      const next = { ...value, ...change };
      // An explicit start view applies only to full-scene, untargeted moves.
      return next.fromFrame && (next.start !== 0 || next.move <= 0 ||
        next.style !== "move" || next.targets.length > 0 || next.follow)
        ? { ...next, fromFrame: undefined } : next;
    });
    setReview(0); setDirty(true); setError(""); setRemove(false);
  }

  function shift(start: number) {
    const next = clamp(roundTime(start), 0, Math.max(0, scene.duration - span));
    const end = Math.min(scene.duration, roundTime(next + span));
    if (next !== draft.start) patch({ start: next, end, move: Math.min(draft.move, end - next), overlays: undefined });
  }

  function chooseTarget(target: string, position: number) {
    const targets = position === 0 ? (target ? [target, ...draft.targets.slice(1).filter(id => id !== target)] : []) :
      [draft.targets[0], ...(target ? [target] : [])];
    const element = scene.elements.find(item => item.id === target);
    patch({ targets, missingTarget: undefined, follow: draft.follow && !!targets.length,
      ...(position === 0 && element ? { offset: { x: 0, y: element.characterId ?
        (draft.style === "close" || draft.style === "reaction" ? -145 : -95) : -24 } } : {}) });
  }

  function loadDraft(shot: CameraShot) {
    setDraft(shot); setReview(0); setCompare(false); setDirty(false); setRemove(false); setError("");
  }

  function apply() {
    if (!review || compare || issue || (conflict && !draft.overlays)) return;
    const framing = shotFraming(scene, draft, draft.targets.length ? sceneFramesAt(project, scene, draft.start) : new Map());
    const shot = draft.targets.length ? { ...draft, frame: { ...draft.frame, x: framing.x, y: framing.y } } : draft;
    if (onApply({ cameraShots: [...others, shot].sort((a, b) => a.start - b.start) })) onClose();
    else setError("The shot could not be applied. Check the project’s scene and camera limits.");
  }

  return <Modal title={SHOT_TITLE} onClose={onClose} wide>
    <p className="field-hint">Frame what viewers should see. Shots use the same animated scene, dialogue, and sounds.</p>
    {initialPreset === "framefield-push" && !editing && (
      <p className="field-hint">
        Gentle imported-PNG push-in preset: the actual numbered PNG frames
        stay untouched. The camera eases from wide to 1.35× across the
        whole scene. Preview Shot or Preview Full Sequence before pressing
        Apply. Cancel leaves your project unchanged.
      </p>
    )}
    {initialPreset === "framefield-reveal" && !editing && (
      <p className="field-hint">
        Gentle cinematic pull-back: the camera eases out from 1.45× to 1×,
        revealing the entire original PNG scene. Preview Shot or Preview
        Full Sequence, then choose Apply or Cancel. The source is unchanged.
      </p>
    )}
    {initialPreset === "framefield-pan" && !editing && (
      <div>
        <p className="field-hint">
          Gentle cinematic side-pan: the original numbered PNGs stay untouched.
          The camera slides slowly toward one side and eases to 1.25× zoom.
          Review the composition before pressing Apply. Cancel makes no changes.
        </p>
        <label>
          Gentle pan direction
          <select aria-label="Gentle pan direction"
            value={draft.frame.x < 400 ? "left" : "right"}
            onChange={event => {
              const direction = event.target.value as FramefieldPanDirection;
              patch({
                frame: { ...draft.frame, ...framefieldCinematicPanFrame(direction) },
                note: "Gentle cinematic pan " + direction +
                  " with slight zoom over original PNG frames",
              });
            }}>
            <option value="left">Slide view left</option>
            <option value="right">Slide view right</option>
          </select>
        </label>
      </div>
    )}
    <div className="interaction-layout shot-director">
      <div className="interaction-controls">
        <label>Choose a scene<select aria-label="Choose a scene" value={scene.id} onChange={event => {
          const index = project.scenes.findIndex(item => item.id === event.target.value);
          if (index >= 0) { if (dirty) setPendingScene(index); else onScene(index); }
        }}>{project.scenes.map((item, i) => <option key={item.id} value={item.id}>{i + 1}. {item.title}</option>)}</select></label>
        {pendingScene !== undefined && <div className="interaction-confirm" role="group" aria-label="Switch scenes">
          <p>Switch scenes and discard the unapplied shot?</p>
          <button className="button secondary small" onClick={() => setPendingScene(undefined)}>Keep editing</button>
          <button className="button secondary small" onClick={() => onScene(pendingScene)}>Switch scene</button>
        </div>}
        {!!list.length && <section aria-label="Shot list" className="shot-list">
          <button className="button secondary small" disabled={saved.length >= MAX_CAMERA_SHOTS}
            onClick={() => loadDraft(newCameraShot(project, scene, time))}>Add Shot</button>
          <label className="world-check"><input type="checkbox" checked={thumbnails}
            onChange={event => setThumbnails(event.target.checked)} /> Show shot thumbnails</label>
          <ol>{list.map((shot, i) => <li key={shot.id}>
            <button className="button secondary small" aria-current={draft.id === shot.id ? "true" : undefined}
              onClick={() => loadDraft(shot)}>
              <strong>{i + 1}. {SHOT_STYLES[shot.style].label} · {subject(shot)}</strong>
              <span>{shot.start.toFixed(2)} s · {(shot.end - shot.start).toFixed(2)} s long · {shot.move ? "Smooth move" : "Straight cut"}</span>
              {shot.note && <small>{shot.note}</small>}
            </button>
            {thumbnails && <Stage project={project} scene={scene} time={(shot.start + shot.end) / 2} calmPreview labelled={false} />}
          </li>)}</ol>
        </section>}
        {warning && <p className="interaction-empty" role="status">A subject or linked event changed. Review the saved timing and framing before applying.</p>}
        {draft.missingTarget && <button className="button secondary small" onClick={() => patch({ targets: [], missingTarget: undefined, follow: false })}>
          Keep the saved fixed frame</button>}
        {draft.missingLink && <button className="button secondary small" onClick={() => patch({ missingLink: undefined })}>Keep the saved timing</button>}
        <label>Shot style<select aria-label="Shot style" value={draft.style}
          onChange={event => patch(shotPreset(scene, draft, event.target.value as ShotStyle))}>
          {Object.entries(SHOT_STYLES).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}
        </select></label>
        <label>Featured subject<select aria-label="Featured subject" value={draft.targets[0] ?? ""}
          onChange={event => chooseTarget(event.target.value, 0)}>
          <option value="">A fixed area of the stage</option>
          {scene.elements.map((item, i) => <option key={item.id} value={item.id}>{elementName(project, item)} · {i + 1}</option>)}
        </select></label>
        {!!draft.targets.length && <>
          <label>Second subject<select aria-label="Second subject" value={draft.targets[1] ?? ""}
            onChange={event => chooseTarget(event.target.value, 1)}>
            <option value="">One subject only</option>
            {scene.elements.filter(item => item.id !== draft.targets[0]).map(item =>
              <option key={item.id} value={item.id}>{elementName(project, item)}</option>)}
          </select></label>
          <label className="world-check"><input type="checkbox" checked={draft.follow}
            onChange={event => patch({ follow: event.target.checked })} /> Follow the subject during the shot</label>
          <label>Subject placement<select value={draft.placement}
            onChange={event => patch({ placement: event.target.value as CameraShot["placement"] })}>
            <option value="center">Center</option><option value="left">Left</option><option value="right">Right</option>
          </select></label>
        </>}
        <fieldset className="interaction-fields">
          <legend>Framing and timing</legend>
          <MediaNumber label={draft.targets.length ? "Detail offset X" : "Frame center X"}
            min={draft.targets.length ? -300 : 0} max={draft.targets.length ? 300 : 800}
            value={draft.targets.length ? draft.offset.x : draft.frame.x}
            onChange={x => patch(draft.targets.length ? { offset: { ...draft.offset, x } } : { frame: { ...draft.frame, x } })} />
          <MediaNumber label={draft.targets.length ? "Detail offset Y" : "Frame center Y"}
            min={draft.targets.length ? -300 : 0} max={draft.targets.length ? 300 : 450}
            value={draft.targets.length ? draft.offset.y : draft.frame.y}
            onChange={y => patch(draft.targets.length ? { offset: { ...draft.offset, y } } : { frame: { ...draft.frame, y } })} />
          <MediaNumber label="Camera zoom" min={1} max={3} step={0.05} value={draft.frame.zoom}
            onChange={zoom => patch({ frame: { ...draft.frame, zoom } })} />
          <MediaNumber label="Shot start (seconds)" max={Math.max(0, scene.duration - span)} value={draft.start} onChange={shift} />
          <MediaNumber label="Shot duration (seconds)" min={0.01} max={scene.duration - draft.start}
            value={span} onChange={duration => patch({ end: Math.min(scene.duration, roundTime(draft.start + duration)), move: Math.min(draft.move, duration), overlays: undefined })} />
        </fieldset>
        <div className="director-actions">
          <button className="button secondary small" disabled={draft.start <= 0} onClick={() => shift(draft.start - 0.25)}>Move Shot Earlier</button>
          <button className="button secondary small" disabled={draft.end + 0.000001 >= scene.duration}
            onClick={() => shift(draft.start + 0.25)}>Move Shot Later</button>
        </div>
        <label>How the shot begins<select aria-label="How the shot begins" value={draft.move ? "smooth" : "cut"}
          onChange={event => patch({ move: event.target.value === "smooth" ? Math.min(1, span) : 0 })}>
          <option value="cut">Straight Cut</option><option value="smooth">Smooth Camera Move</option>
        </select></label>
        {!!draft.move && <MediaNumber label="Move duration (seconds)" min={0.01} max={span} value={draft.move}
          onChange={move => patch({ move })} />}
        <label>Directing note<input maxLength={160} value={draft.note} onChange={event => patch({ note: event.target.value })} /></label>
        <details className="focus-appearance">
          <summary>Connect to a script line or learning moment</summary>
          <label>Script line<select aria-label="Script line" value={draft.lineId ?? ""}
            onChange={event => patch({ lineId: event.target.value || undefined })}>
            <option value="">No script line</option>
            {scene.script?.lines.map(line => <option key={line.id} value={line.id}>{line.text.slice(0, 88) || "Untitled line"}</option>)}
          </select></label>
          {!!cues.length && <label>Learning or animation event<select aria-label="Learning or animation event"
            value={draft.cue ? shotAnchorKey(draft.cue.anchor) : ""} onChange={event => {
              const selected = cues.find(item => shotAnchorKey(item.anchor) === event.target.value);
              patch({ cue: selected ? { anchor: selected.anchor, reviewedAt: selected.at } : undefined, missingLink: undefined });
            }}>
            <option value="">Keep manual shot timing</option>
            {cues.map(item => <option key={shotAnchorKey(item.anchor)} value={shotAnchorKey(item.anchor)}>
              {item.at.toFixed(2)} s · {item.label.slice(0, 100)}
            </option>)}
          </select></label>}
          {cue && <button className="button secondary small" disabled={cue.at >= scene.duration}
            onClick={() => {
              const end = Math.min(scene.duration, roundTime(cue.at + span));
              patch({ start: cue.at, end, move: Math.min(draft.move, end - cue.at),
                cue: { anchor: cue.anchor, reviewedAt: cue.at }, missingLink: undefined,
                overlays: cue.at === draft.start ? draft.overlays : undefined });
            }}>Use this event’s start time</button>}
          <p className="field-hint">Later event edits flag the shot for review and keep your approved shot timing.</p>
        </details>
      </div>
      <div className="interaction-review">
        {conflict && <div className="interaction-empty">
          <p>The scene already has a camera track. This shot uses its own framing only during the selected time. The original keys and follow settings stay saved.</p>
          <label className="world-check"><input type="checkbox" checked={!!draft.overlays}
            onChange={event => setDraft(value => ({ ...value, overlays: event.target.checked ? true : undefined }))} />
            Use this shot over the camera track during its time</label>
        </div>}
        <div className="director-actions">
          <button className="button secondary" disabled={!!issue} onClick={() => { setMode("shot"); setCompare(false); setReview(value => value + 1); }}>Preview Shot</button>
          <button className="button secondary" disabled={!!issue} onClick={() => { setMode("sequence"); setCompare(false); setReview(value => value + 1); }}>Preview Full Sequence</button>
        </div>
        {issue && <p role="status" className="interaction-empty">{issue}</p>}
        {!!review && !issue && <>
          <label className="world-check"><input type="checkbox" checked={compare} onChange={event => setCompare(event.target.checked)} /> Compare with the saved camera</label>
          <label className="world-check"><input type="checkbox" checked={guides} onChange={event => setGuides(event.target.checked)} /> Show composition and caption guides</label>
          {subjectsOutside(project, planned, draft) && <p className="interaction-empty" role="status">
            A selected subject may be near the edge or out of view. Check it at the start, during movement, and near the end.
          </p>}
          <ScenePreview key={review} project={project} scene={previewScene} showCaptions precision={2}
            captionGuide={guides} shotGuides={guides ? { ids: draft.targets, offset: draft.offset } : undefined}
            initialTime={mode === "shot" ? previewTime : 0}
            playFrom={mode === "shot" ? draft.start : 0} playTo={mode === "shot" ? draft.end : scene.duration}
            soundPreview={project.audioClips.length > 0} />
        </>}
      </div>
    </div>
    {error && <p role="alert">{error}</p>}
    {remove && <div className="interaction-confirm" role="group" aria-label="Remove shot">
      <p>Remove this camera shot? The original camera and animation remain available.</p>
      <button className="button secondary" onClick={() => setRemove(false)}>Keep shot</button>
      <button className="button danger" onClick={() => { if (onApply({ cameraShots: others })) onClose(); }}>Remove shot</button>
    </div>}
    <div className="modal-actions">
      {editing && !remove && <>
        <button className="button text" disabled={saved.length >= MAX_CAMERA_SHOTS} onClick={() => {
          const range = shotGap(scene, draft.end);
          patch({ id: uid(), ...range, move: Math.min(draft.move, range.end - range.start), overlays: undefined });
        }}>Duplicate Shot</button>
        <button className="button text" onClick={() => setRemove(true)}>Delete Shot</button>
      </>}
      <button className="button secondary" onClick={onClose}>Cancel</button>
      <button className="button primary" disabled={!review || compare || !!issue || (conflict && !draft.overlays)} onClick={apply}>Apply</button>
    </div>
  </Modal>;
}
