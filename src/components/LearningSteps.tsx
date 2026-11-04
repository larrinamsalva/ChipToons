import { useState } from "react";
import { elementName } from "../library";
import { INTERACTION_LABELS, interactionEvents } from "../interaction-model";
import { uid } from "../model";
import type { Project, Scene } from "../model";
import { changeTime, learningIssue, MAX_LEARNING_STEPS, STARTER_STEPS, stepTime } from "../transform-model";
import type { LearningStep } from "../transform-model";
import { MediaNumber } from "./MediaNumber";
import { ScenePreview } from "./ScenePreview";

export function LearningSteps({ project, scene, onApply, onLine }: {
  project: Project; scene: Scene;
  onApply: (steps: LearningStep[]) => boolean | void;
  onLine: (id: string) => void;
}) {
  const saved = JSON.stringify(scene.learningSteps ?? []);
  const [seen, setSeen] = useState(saved);
  const [draft, setDraft] = useState(scene.learningSteps ?? []);
  const [selected, setSelected] = useState(draft[0]?.id ?? "");
  const [preview, setPreview] = useState<LearningStep>();
  const [notice, setNotice] = useState("");
  if (saved !== seen) {
    setSeen(saved);
    setDraft(scene.learningSteps ?? []);
    if (!scene.learningSteps?.some(step => step.id === selected)) setSelected(scene.learningSteps?.[0]?.id ?? "");
    setPreview(undefined);
  }
  const current = draft.find(step => step.id === selected);
  const options = [
    ...(scene.objectTracks ?? []).flatMap(track => {
      const object = scene.elements.find(item => item.id === track.objectId);
      return track.changes.map(change => ({
        key: change.id, at: changeTime(scene, track, change), cue: { kind: "change" as const, changeId: change.id },
        title: `${object ? elementName(project, object) : "Object"} → ${track.states.find(state => state.id === change.to)?.name ?? "Appearance"}`,
      }));
    }),
    ...(scene.interactions ?? []).flatMap(action => interactionEvents(action).map(event => ({
      key: JSON.stringify([action.id, event.name]), at: event.time,
      cue: { kind: "action" as const, interactionId: action.id, moment: event.name },
      title: `${INTERACTION_LABELS[action.kind]} · ${event.name}`,
    }))),
  ];
  function update(patch: Partial<LearningStep>) {
    setDraft(value => value.map(step => step.id === selected ? { ...step, ...patch } : step));
    setPreview(undefined); setNotice("");
  }
  const issue = learningIssue(draft, scene);
  const lines = scene.script?.lines ?? [];
  return <details className="director-card learning-steps">
    <summary>Teach It Step by Step</summary>
    <p className="field-hint">Link each instruction to a real moment. Check the preview to see if the animation shows what the words describe.</p>
    <div className="director-actions">
      {!draft.length && <button className="button secondary" onClick={() => {
        const steps = STARTER_STEPS.map((text, index) => ({ id: uid(), text,
          at: Math.round((0.08 + index * 0.14) * scene.duration * 100) / 100 }));
        setDraft(steps); setSelected(steps[0].id); setNotice("");
      }}>Start with seven learning steps</button>}
      <button className="button secondary" disabled={draft.length >= MAX_LEARNING_STEPS} onClick={() => {
        const step = { id: uid(), text: "New learning step", at: 0 };
        setDraft([...draft, step]); setSelected(step.id); setPreview(undefined); setNotice("");
      }}>Add learning step</button>
    </div>
    {!!draft.length && <ol className="director-lines learning-sequence" aria-label="Learning steps in time order">
      {[...draft].sort((a, b) => stepTime(scene, a) - stepTime(scene, b)).map((step, index) =>
        <li key={step.id}><button className="button secondary small" aria-current={step.id === selected ? "step" : undefined}
          onClick={() => { setSelected(step.id); setPreview(undefined); }}>
          <strong>{index + 1}. {step.text || "Unnamed step"}</strong>
          <small>{stepTime(scene, step).toFixed(2)} s</small>
        </button></li>)}
    </ol>}
    {current && <>
      <div className="form-grid">
        <label>What will viewers learn?<input maxLength={250} value={current.text} onChange={event => update({ text: event.target.value })} /></label>
        <label>What will viewers see?<select aria-label="What will viewers see?" value={current.cue?.kind === "change" ? current.cue.changeId :
          current.cue ? JSON.stringify([current.cue.interactionId, current.cue.moment]) : ""} onChange={event => {
          const option = options.find(item => item.key === event.target.value);
          update({ cue: option?.cue, at: option?.at ?? stepTime(scene, current) });
        }}>
          <option value="">Use a scene time</option>
          {options.map(option => <option key={option.key} value={option.key}>{option.title} · {option.at.toFixed(2)} s</option>)}
        </select></label>
        {!current.cue && <MediaNumber label="Learning step time (seconds)" value={current.at}
          max={scene.duration} onChange={at => update({ at })} />}
        <label>Instructional script line<select aria-label="Instructional script line" value={current.lineId ?? ""}
          onChange={event => update({ lineId: event.target.value || undefined })}>
          <option value="">Choose a line if needed</option>
          {lines.map((line, i) => <option key={line.id} value={line.id}>{i + 1}. {line.text.slice(0, 100)}</option>)}
        </select></label>
      </div>
      <p className="field-hint">{current.cue ? "Linked scene moment" : "Preview the animation and check this instruction"} · {stepTime(scene, current).toFixed(2)} s</p>
      <div className="director-actions">
        <button className="button secondary small" onClick={() => setPreview(current)}>Check this moment in the scene</button>
        {current.lineId && <button className="button text small" onClick={() => onLine(current.lineId!)}>Open linked script line</button>}
        <button className="button text small" onClick={() => {
          const remaining = draft.filter(step => step.id !== current.id);
          setDraft(remaining); setSelected(remaining[0]?.id ?? ""); setPreview(undefined); setNotice("");
        }}>Remove from draft</button>
      </div>
    </>}
    {preview && <ScenePreview key={preview.id} project={project} scene={scene} initialTime={stepTime(scene, preview)} precision={2} />}
    {issue && <p role="alert">{issue}</p>}
    <div className="director-actions">
      <button className="button primary small" disabled={!!issue || JSON.stringify(draft) === saved}
        onClick={() => { if (onApply(draft) !== false) setNotice("Learning steps saved."); }}>Apply learning steps</button>
      {notice && <span role="status">{notice}</span>}
    </div>
  </details>;
}
