import { useState } from "react";
import { FOCUS_TYPES, focusIssue, focusWindow } from "../focus-model";
import { cueKey, focusCueChoices } from "../focus-studio";
import { elementName } from "../library";
import { makeScene, uid } from "../model";
import type { Project, Scene } from "../model";
import { ACTIVITIES, allowsChoices, CHOICE_ICONS, MAX_PARTICIPATION_MOMENTS, participationIssue, participationWindow,
  PARTICIPATION_TITLE } from "../participation-model";
import type { Activity, Choice, Participation } from "../participation-model";
import { createParticipationLines, newParticipation, participationVoice, participationWarnings, PROMPTS } from "../participation-studio";
import { withScript } from "../script";
import { MAX_SCRIPT_LINES } from "../script-model";
import { stepTime } from "../transform-model";
import { MediaNumber } from "./MediaNumber";
import { Modal } from "./Modal";
import { ScenePreview } from "./ScenePreview";

export function ParticipationStudio({ project, scene, time, id, stepId, onScene, onClose, onApply, onScript, onSound }: {
  project: Project; scene: Scene; time: number; id?: string; stepId?: string;
  onScene: (index: number) => void; onClose: () => void; onApply: (patch: Partial<Scene>, dedicated?: Scene) => boolean;
  onScript: (lineId?: string, stepId?: string) => void;
  onSound: (id: string) => void;
}) {
  const [dedicated, setDedicated] = useState<Scene>();
  const active = dedicated ?? scene;
  const [draft, setDraft] = useState(() => scene.participation?.find(item => item.id === id) ?? newParticipation(scene, time, stepId));
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(0);
  const [reviewed, setReviewed] = useState(false);
  const [prepareLines, setPrepareLines] = useState(false);
  const [pendingScene, setPendingScene] = useState<number>();
  const [remove, setRemove] = useState(false);
  const [error, setError] = useState("");
  const moments = active.participation ?? [];
  const editing = moments.some(item => item.id === draft.id);
  const others = moments.filter(item => item.id !== draft.id);
  const proposed = { ...active, participation: [...others, draft] };
  const window = participationWindow(draft);
  const missingLines = Number(!draft.questionLineId) + Number(!draft.answerLineId);
  const issue = participationIssue(proposed.participation, proposed) || focusIssue(proposed.focusGraphics, proposed) ||
    (prepareLines && missingLines + (active.script?.lines.length ?? Number(!!active.narration) + Number(!!active.dialogue)) > MAX_SCRIPT_LINES
      ? "This scene has no room for more script lines. Use existing lines or a dedicated scene." : undefined);
  const lines = active.script?.lines ?? [];
  const cast = project.characters.filter(character => active.elements.some(item => item.characterId === character.id));
  const questionVoice = participationVoice(project, active, draft.questionLineId);
  const answerVoice = participationVoice(project, active, draft.answerLineId);
  const step = active.learningSteps?.find(item => item.id === draft.stepId);
  const availableGraphics = active.focusGraphics?.filter(item => !others.some(moment => moment.focusId === item.id)) ?? [];
  const warnings = participationWarnings(project, active, draft);
  const animationTimes = [
    ...focusCueChoices(project, active).filter(item => item.cue.kind !== "step")
      .map(item => ({ id: cueKey(item.cue), time: item.at, label: item.name })),
    ...(active.cameraAnimation?.keyframes ?? []).map(key => ({ id: key.id, time: key.time, label: "Camera" })),
    ...active.elements.flatMap(item => (item.animation?.keyframes ?? []).map(key => ({
      id: key.id, time: key.time, label: elementName(project, item),
    }))),
  ].filter(item => item.time >= draft.askFor + draft.thinkFor && item.time + draft.revealFor <= active.duration)
    .sort((a, b) => Math.abs(a.time - window.reveal) - Math.abs(b.time - window.reveal))
    .slice(0, 60).sort((a, b) => a.time - b.time);

  function patch(change: Partial<Participation>) {
    setDraft(item => ({ ...item, ...change }));
    setDirty(true); setReviewed(false); setError("");
  }
  function chooseType(kind: Activity) {
    const old = PROMPTS[draft.kind], next = PROMPTS[kind];
    const choices = !allowsChoices(kind) ? [] : kind === "choose" && !draft.choices.length
      ? [{ text: "Ask a grown-up" }, { text: "Try it alone" }] : draft.choices;
    patch({ kind, question: draft.question === old.question ? next.question : draft.question,
      feedback: draft.feedback === old.feedback ? next.feedback : draft.feedback,
      choices, answer: choices.length ? draft.answer ?? 0 : undefined });
  }
  function changeChoice(index: number, change: Partial<Choice>) {
    patch({ choices: draft.choices.map((item, i) => i === index ? { ...item, ...change } : item) });
  }
  function chooseLine(value: string, role: "question" | "answer") {
    const id = value || undefined;
    const { line } = participationVoice(project, active, id);
    if (role === "question") patch({ questionLineId: id, question: line?.text.trim().slice(0, 84) || draft.question });
    else patch({ answerLineId: id, feedback: line?.text.trim().slice(0, 110) || draft.feedback });
  }
  function dedicatedDraft() {
    const members = [...cast].sort((a, b) => Number(b.id === draft.speakerId) - Number(a.id === draft.speakerId));
    const fresh = makeScene(members.length ? members : project.characters);
    setDedicated({ ...fresh, title: "Pause, think, and try", narration: "", background: scene.background,
      duration: Math.max(10, Math.ceil(window.end - window.start + 1)), transition: "cut", chapter: scene.chapter });
    patch({ id: uid(), at: 0, questionLineId: undefined, answerLineId: undefined, focusId: undefined, stepId: undefined });
    setPreview(0);
  }
  function apply() {
    if (issue || !reviewed) return;
    const saved = { ...draft, review: undefined };
    let next: Scene = { ...active, participation: [...others, saved] };
    if (prepareLines && missingLines) {
      const prepared = createParticipationLines(active, saved);
      next = withScript({ ...active, participation: [...others, prepared.moment] }, prepared.script);
    }
    if (onApply({ participation: next.participation, script: next.script, narration: next.narration, dialogue: next.dialogue },
      dedicated ? next : undefined)) onClose();
    else setError("This edit could not be saved. Check the scene limits and try again.");
  }
  function editMoment(moment: Participation) {
    setDraft(moment); setPreview(0); setReviewed(false); setPrepareLines(false); setDirty(false); setError("");
  }
  return <Modal title={PARTICIPATION_TITLE} onClose={onClose} wide>
    <p className="field-hint">Invite children to think or speak aloud. The cartoon keeps playing and never collects their answers.</p>
    <div className="interaction-layout participation-layout">
      <div className="interaction-controls">
        <label>Choose a scene<select value={dedicated ? dedicated.id : scene.id} onChange={event => {
          const index = project.scenes.findIndex(item => item.id === event.target.value);
          if (index >= 0) { if (dirty || dedicated) setPendingScene(index); else onScene(index); }
        }}>
          {project.scenes.map((item, index) => <option key={item.id} value={item.id}>{index + 1}. {item.title}</option>)}
          {dedicated && <option value={dedicated.id}>New participation scene (draft)</option>}
        </select></label>
        {pendingScene !== undefined && <div className="interaction-confirm" role="group" aria-label="Switch scenes">
          <p>Switch scenes and discard this unapplied draft?</p>
          <button className="button secondary small" onClick={() => setPendingScene(undefined)}>Keep editing</button>
          <button className="button secondary small" onClick={() => {
            if (project.scenes[pendingScene]?.id !== scene.id) onScene(pendingScene);
            else {
              setDedicated(undefined); setPendingScene(undefined); editMoment(newParticipation(scene, time));
            }
          }}>Switch scene</button>
        </div>}
        {!!moments.length && <label>Participation moment<select value={editing ? draft.id : ""} onChange={event => {
          const moment = moments.find(item => item.id === event.target.value);
          editMoment(moment ?? newParticipation(active, time));
        }}>
          <option value="">New moment</option>
          {moments.map(moment => <option key={moment.id} value={moment.id}>{moment.at.toFixed(2)} s · {moment.question}</option>)}
        </select></label>}
        {draft.review && <p role="status" className="interaction-empty">A linked speaker, line, learning step, or graphic changed. Review the remaining links before applying.</p>}
        <label>Learning activity<select value={draft.kind} onChange={event => chooseType(event.target.value as Activity)}>
          {Object.entries(ACTIVITIES).map(([kind, name]) => <option key={kind} value={kind}>{name}</option>)}
        </select></label>
        <details className="focus-appearance"><summary>Suggestions for ages 4–7</summary>
          <p><strong>Ages 4–5.</strong> {PROMPTS[draft.kind].young}</p>
          <p><strong>Ages 6–7.</strong> {PROMPTS[draft.kind].older}</p>
          <p>Keep directions short. Ask for a safe action or a kind idea, and leave names and personal details out.</p>
        </details>
        <label>Ask the Kids a Question<input maxLength={84} value={draft.question} onChange={event => patch({ question: event.target.value })} /></label>
        <label>Who asks?<select value={draft.speakerId ?? ""} onChange={event =>
          patch({ speakerId: event.target.value || undefined, questionLineId: undefined })}>
          <option value="">Narrator</option>
          {cast.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
        <fieldset className="interaction-fields">
          <legend>Give Them Thinking Time</legend>
          <MediaNumber label="Question starts (seconds)" max={active.duration} value={draft.at} onChange={at => patch({ at })} />
          <MediaNumber label="Read or say the question (seconds)" min={0.5} max={12} value={draft.askFor} onChange={askFor => patch({ askFor })} />
          <MediaNumber label="Thinking time (seconds)" min={3} max={10} value={draft.thinkFor} onChange={thinkFor => patch({ thinkFor })} />
          <MediaNumber label="Show the reveal for (seconds)" min={1} max={15} value={draft.revealFor} onChange={revealFor => patch({ revealFor })} />
        </fieldset>
        <p className="field-hint">Thinking begins at {window.think.toFixed(2)} s. Reveal the Answer at {window.reveal.toFixed(2)} s.</p>
        {!!animationTimes.length && <label>Line up the reveal with animation<select value="" onChange={event => {
          const key = animationTimes.find(item => item.id === event.target.value);
          if (key) patch({ at: key.time - draft.askFor - draft.thinkFor });
        }}>
          <option value="">Keep my chosen time</option>
          {animationTimes.map(item => <option key={item.id} value={item.id}>{item.time.toFixed(2)} s · {item.label.slice(0, 90)}</option>)}
        </select></label>}
        {window.end > active.duration && !dedicated && <button className="button secondary small" disabled={project.scenes.length >= 120}
          onClick={dedicatedDraft}>Draft a dedicated participation scene</button>}
        {allowsChoices(draft.kind) && <fieldset className="participation-choices">
          <legend>Show Some Choices</legend>
          {draft.kind !== "choose" && <label className="world-check"><input type="checkbox" checked={!!draft.choices.length}
            onChange={event => patch({ choices: event.target.checked ? [{ text: "" }, { text: "" }] : [],
              answer: event.target.checked ? 0 : undefined })} /> Show two or three choices</label>}
          {draft.choices.map((choice, index) => <div key={index} className="interaction-fields">
            <label>Choice {index + 1}<input maxLength={24} value={choice.text} onChange={event => changeChoice(index, { text: event.target.value })} /></label>
            <label>Icon for choice {index + 1}<select value={choice.icon ?? ""} onChange={event =>
              changeChoice(index, { icon: (event.target.value || undefined) as Choice["icon"] })}>
              <option value="">None</option>
              {Object.entries(CHOICE_ICONS).map(([name, symbol]) => <option key={name} value={name}>{symbol} {name}</option>)}
            </select></label>
            <label>Note for choice {index + 1}<input maxLength={54} value={choice.explanation ?? ""} onChange={event =>
              changeChoice(index, { explanation: event.target.value || undefined })} /></label>
          </div>)}
          {!!draft.choices.length && <>
            <label>Choice shown in the reveal<select value={draft.answer} onChange={event => patch({ answer: Number(event.target.value) })}>
              {draft.choices.map((item, index) => <option key={index} value={index}>{index + 1}. {item.text || "Untitled choice"}</option>)}
            </select></label>
            <button className="button secondary small" onClick={() => patch(draft.choices.length < 3
              ? { choices: [...draft.choices, { text: "" }] }
              : { choices: draft.choices.slice(0, 2), answer: draft.answer === 2 ? 0 : draft.answer })}>
              {draft.choices.length < 3 ? "Add a third choice" : "Remove the third choice"}
            </button>
          </>}
        </fieldset>}
        <label>Explain What Happened<textarea maxLength={110} value={draft.feedback} onChange={event => patch({ feedback: event.target.value })} /></label>
        <details className="focus-appearance">
          <summary>Connect voices, learning steps, and teaching graphics</summary>
          <label>Question script line<select value={draft.questionLineId ?? ""} onChange={event => chooseLine(event.target.value, "question")}>
            <option value="">No line selected</option>
            {lines.filter(item => item.speakerId === draft.speakerId && item.id !== draft.answerLineId)
              .map(item => <option key={item.id} value={item.id}>{item.text.slice(0, 85) || "Blank line"}</option>)}
          </select></label>
          <label>Explanation script line<select value={draft.answerLineId ?? ""} onChange={event => chooseLine(event.target.value, "answer")}>
            <option value="">No line selected</option>
            {lines.filter(item => item.id !== draft.questionLineId)
              .map(item => <option key={item.id} value={item.id}>{item.text.slice(0, 85) || "Blank line"}</option>)}
          </select></label>
          {questionVoice.clip && <button className="button secondary small" onClick={() => {
            const clip = questionVoice.clip!;
            patch({ at: clip.start, askFor: Math.min(12, Math.max(0.5, clip.duration)) });
          }}>Use question recording timing</button>}
          {answerVoice.clip && <p className="field-hint">Explanation recording starts at {answerVoice.clip.start.toFixed(2)} s.</p>}
          {!!missingLines && <label className="world-check"><input type="checkbox" checked={prepareLines} onChange={event => {
            setPrepareLines(event.target.checked); setDirty(true); setReviewed(false);
          }} /> Add missing words to Script &amp; Voice Director when I apply</label>}
          <label>Learning step<select value={draft.stepId ?? ""} onChange={event => patch({ stepId: event.target.value || undefined })}>
            <option value="">No step selected</option>
            {active.learningSteps?.map(item => <option key={item.id} value={item.id}>{item.text.slice(0, 85)}</option>)}
          </select></label>
          {step && <button className="button secondary small" disabled={stepTime(active, step) < draft.askFor + draft.thinkFor}
            onClick={() => patch({ at: Math.max(0, stepTime(active, step) - draft.askFor - draft.thinkFor) })}>Match reveal to learning step</button>}
          <label>Teaching graphic on reveal<select value={draft.focusId ?? ""} onChange={event => patch({ focusId: event.target.value || undefined })}>
            <option value="">No graphic selected</option>
            {availableGraphics.map(item => <option key={item.id} value={item.id}>{item.text || FOCUS_TYPES[item.kind]} · {focusWindow(active, item, true).start.toFixed(2)} s</option>)}
          </select></label>
          <p className="field-hint">The chosen graphic appears during the reveal and keeps its saved object or position. Unlink it to return to its own timing. A learning step can point to a gesture, action, or appearance change.</p>
          {!dedicated && <div className="director-actions">
            <button className="button secondary small" disabled={dirty} onClick={() => onScript(draft.questionLineId)}>Open Script &amp; Voice Director</button>
            {draft.answerLineId && <button className="button secondary small" disabled={dirty} onClick={() => onScript(draft.answerLineId)}>Open explanation line</button>}
            {step && <button className="button secondary small" disabled={dirty} onClick={() => onScript(undefined, step.id)}>Open linked learning step</button>}
          </div>}
          {dirty && <p className="field-hint">Apply your draft before opening the script or learning steps.</p>}
        </details>
      </div>
      <div className="interaction-review">
        <button className="button secondary" disabled={!!issue} onClick={() => { setPreview(value => value + 1); setReviewed(true); }}>Preview</button>
        {issue && <p role="status" className="interaction-empty">{issue}</p>}
        {!!warnings.length && <ul aria-label="Timing and recording notes" className="participation-warnings">{warnings.map(message => <li key={message}>{message}</li>)}</ul>}
        {preview > 0 && !issue && <>
          <p role="status">{reviewed ? "Ready to apply after your review." : "Preview the latest changes before applying."}</p>
          <ScenePreview key={preview} project={project} scene={proposed} precision={2} initialTime={window.start}
            playFrom={window.start} showCaptions soundPreview={!dedicated && project.audioClips.length > 0} />
        </>}
      </div>
    </div>
    {error && <p role="alert">{error}</p>}
    {remove && <div className="interaction-confirm" role="group" aria-label="Remove this moment">
      <p>Remove this participation moment? Its original recordings, script lines, and teaching graphic stay available.</p>
      <button className="button secondary" onClick={() => setRemove(false)}>Keep it</button>
      <button className="button danger" onClick={() => { if (onApply({ participation: others })) onClose(); }}>Remove moment</button>
    </div>}
    <div className="modal-actions">
      {editing && !remove && <>
        <button className="button secondary small" disabled={dirty} onClick={() => onSound(draft.id)}>Add sound to the reveal</button>
        <button className="button text" disabled={moments.length >= MAX_PARTICIPATION_MOMENTS} onClick={() => {
          patch({ id: uid(), at: Math.min(active.duration, window.end), focusId: undefined });
        }}>Duplicate moment</button>
        <button className="button text" onClick={() => setRemove(true)}>Delete moment</button>
      </>}
      <button className="button secondary" onClick={onClose}>Cancel</button>
      <button className="button primary" disabled={!!issue || !reviewed} onClick={apply}>Apply</button>
    </div>
  </Modal>;
}
