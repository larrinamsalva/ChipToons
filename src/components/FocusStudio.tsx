import { useState } from "react";
import { elementName } from "../library";
import type { Project, Scene } from "../model";
import { canDrawFocus, focusIssue, focusWindow, FOCUS_STYLES, FOCUS_TITLE, FOCUS_TYPES, stepNeedsReview } from "../focus-model";
import type { FocusGraphic, FocusKind, FocusStyle } from "../focus-model";
import { focusContrast, focusLayout, intersects, sceneCaptionBand } from "../focus-motion";
import { cueKey, focusCueChoices, newFocusGraphic, reviewedFocusPlacement } from "../focus-studio";
import type { FocusSeed } from "../focus-studio";
import { MediaNumber } from "./MediaNumber";
import { Modal } from "./Modal";
import { ScenePreview } from "./ScenePreview";


export function FocusStudio({ project, scene, time, seed, graphicId, onScene, onClose, onApply }: {
  project: Project; scene: Scene; time: number; seed?: FocusSeed; graphicId?: string;
  onScene: (index: number) => void; onClose: () => void; onApply: (patch: Partial<Scene>) => boolean;
}) {
  const [original] = useState(() => scene.focusGraphics?.find(item => item.id === graphicId));
  const [graphic, setGraphic] = useState(() => original ?? newFocusGraphic(scene, time, seed));
  const [preview, setPreview] = useState(0);
  const [reviewed, setReviewed] = useState(false);
  const [guide, setGuide] = useState(true);
  const [pickPosition, setPickPosition] = useState(false);
  const [pendingScene, setPendingScene] = useState<number>();
  const [remove, setRemove] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const window = focusWindow(scene, graphic, true);
  const displayWindow = focusWindow(scene, graphic);
  const linked = scene.participation?.some(moment => moment.focusId === graphic.id);
  const others = (scene.focusGraphics ?? []).filter(item => item.id !== graphic.id);
  const proposed = { ...scene, focusGraphics: [...others, graphic] };
  const issue = (graphic.kind === "label" || graphic.kind === "card") && !graphic.text.trim()
    ? "Add a short line of teaching text for this graphic."
    : window.end <= window.start ? "This cue is at the end of the scene. Choose an earlier time."
      : focusIssue(proposed.focusGraphics, proposed);
  const source = graphic.stepSource && scene.learningSteps?.find(step => step.id === graphic.stepSource?.id);
  const cues = focusCueChoices(project, scene);
  const target = graphic.target;
  const { point, cast, outside } = reviewedFocusPlacement(project, scene, graphic, window.start);
  const band = sceneCaptionBand(project, scene);
  const layout = focusLayout(graphic, point, band);
  const box = layout.box;
  const overlapsCast = box && cast.some(region => intersects(box, region));
  const contrast = focusContrast(graphic.ink, graphic.paper);
  const position = target.kind === "object" ? "object" : "screen";

  function patch(change: Partial<FocusGraphic>) {
    setGraphic(value => ({ ...value, ...change }));
    setReviewed(false); setDirty(true); setError("");
  }
  function setStart(at: number) {
    const length = Math.max(0.01, Math.min(graphic.length, scene.duration - at));
    setTiming(at, length);
  }
  function setTiming(at: number, length: number) {
    const scale = Math.min(1, length / (graphic.fadeIn + graphic.fadeOut || 1));
    patch({ at, length, fadeIn: graphic.fadeIn * scale, fadeOut: graphic.fadeOut * scale });
  }
  function changeTarget(value: string) {
    setPickPosition(false);
    if (!value) { patch({ target: { kind: "screen", ...point } }); return; }
    const object = scene.elements.find(item => item.id === value);
    if (object) patch({ target: { kind: "object", id: object.id, ...point, dx: 0, dy: object.characterId ? -110 : -30 } });
  }
  function apply() {
    if (issue || !reviewed) return;
    const saved = target.kind === "object" ? { ...graphic, target: { ...target, ...point } } : graphic;
    if (onApply({ focusGraphics: [...others, saved] })) onClose();
    else setError("The graphic could not be saved. Check its target and timing.");
  }
  return <Modal title={FOCUS_TITLE} onClose={onClose} wide>
    <p className="field-hint">Point out what children should notice. Teaching graphics appear in the movie and stay separate from spoken captions.</p>
    <div className="interaction-layout focus-layout">
      <div className="interaction-controls">
        <label>Choose a scene<select aria-label="Choose a scene" value={scene.id} onChange={event => {
          const index = project.scenes.findIndex(item => item.id === event.target.value);
          if (index < 0) return;
          if (dirty) setPendingScene(index); else onScene(index);
        }}>{project.scenes.map((item, index) => <option key={item.id} value={item.id}>{index + 1}. {item.title}</option>)}</select></label>
        {pendingScene !== undefined && <div role="group" aria-label="Confirm changing scenes" className="interaction-confirm">
          <p>Switch scenes and discard this unapplied graphic?</p>
          <button className="button secondary small" onClick={() => setPendingScene(undefined)}>Keep editing</button>
          <button className="button secondary small" onClick={() => onScene(pendingScene)}>Switch scene</button>
        </div>}
        <label>Teaching graphic<select aria-label="Teaching graphic" value={graphic.kind} onChange={event => {
          const kind = event.target.value as FocusKind;
          patch({ kind, reveal: canDrawFocus(kind) && graphic.reveal,
            size: kind === "number" ? 46 : kind === "card" ? 96 : 82,
            text: graphic.text || (kind === "label" ? "Look here" : kind === "card" ? "Let's look carefully." : "") });
        }}>{Object.entries(FOCUS_TYPES).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>
        <label>Positioning<select aria-label="Positioning" value={position} onChange={event =>
          changeTarget(event.target.value === "object" ? scene.elements[0]?.id ?? "" : "")}>
          <option value="screen">Stay on Screen</option>
          <option value="object" disabled={!scene.elements.length}>Follow Object</option>
        </select></label>
        {target.kind === "missing" && <p className="interaction-empty" role="status">The original target was removed. Choose another object or keep this graphic at its saved screen position.</p>}
        {target.kind === "missing" && <button className="button secondary small" onClick={() => changeTarget("")}>Keep this screen position</button>}
        {target.kind === "object" ? <>
          <label>Choose an object<select aria-label="Choose an object" value={target.id} onChange={event => changeTarget(event.target.value)}>
            {scene.elements.map((item, index) => <option key={item.id} value={item.id}>{elementName(project, item)} · {index + 1}</option>)}
          </select></label>
          <div className="interaction-fields">
            <MediaNumber label="Detail offset X" min={-300} max={300} value={target.dx} onChange={dx => patch({ target: { ...target, dx } })} />
            <MediaNumber label="Detail offset Y" min={-300} max={300} value={target.dy} onChange={dy => patch({ target: { ...target, dy } })} />
          </div>
          <p className="field-hint">Offsets point to a detail on the object, such as its wheel, as it moves.</p>
        </> : <>
          <div className="interaction-fields">
            <MediaNumber label="Screen X" max={800} value={target.x} onChange={x => patch({ target: { ...target, x } })} />
            <MediaNumber label="Screen Y" max={450} value={target.y} onChange={y => patch({ target: { ...target, y } })} />
          </div>
          {preview > 0 && <label className="world-check"><input type="checkbox" checked={pickPosition}
            onChange={event => setPickPosition(event.target.checked)} /> Pick a position in the preview</label>}
        </>}
        <label>Teaching text<input maxLength={88} value={graphic.text} onChange={event => patch({ text: event.target.value })}
          placeholder="Keep it short and simple" /></label>
        {graphic.kind === "number" && <MediaNumber label="Step number" value={graphic.number} min={1} max={99} step={1}
          onChange={number => patch({ number: Math.round(number) })} />}
        {linked && <p className="field-hint">This graphic appears during its participation reveal. The times below apply when it is unlinked.</p>}
        <fieldset className="interaction-fields">
          <legend>Choose When It Appears</legend>
          {!graphic.cue ? <MediaNumber label="Start time (seconds)" min={0} max={scene.duration - 0.01}
            value={graphic.at} onChange={setStart} /> :
            <p className="field-hint">Linked start · {window.start.toFixed(2)} s</p>}
          <MediaNumber label="End time (seconds)" min={Math.min(scene.duration, window.start + 0.01)}
            max={scene.duration} value={window.end} onChange={end => setTiming(graphic.at, end - window.start)} />
        </fieldset>
        {cues.length > 0 && <label>Link start to a scene moment<select aria-label="Link start to a scene moment"
          value={graphic.cue ? cueKey(graphic.cue) : ""} onChange={event => {
            const next = cues.find(item => cueKey(item.cue) === event.target.value);
            const at = next?.at ?? Math.min(scene.duration - 0.01, window.start);
            const length = Math.max(0.01, Math.min(graphic.length, scene.duration - at));
            const ratio = Math.min(1, length / (graphic.fadeIn + graphic.fadeOut || 1));
            patch({ cue: next?.cue, at, length, fadeIn: graphic.fadeIn * ratio, fadeOut: graphic.fadeOut * ratio });
          }}>
          <option value="">Set my own time</option>
          {cues.map(item => <option key={cueKey(item.cue)} value={cueKey(item.cue)}>{item.name} · {item.at.toFixed(2)} s</option>)}
        </select></label>}
        {source && <p className="field-hint">Suggested by this learning step: {source.text}</p>}
        {graphic.stepSource && !source && <div className="interaction-empty" role="status">
          <p>The original learning step was removed. The teaching graphic and its wording are still here.</p>
          <button className="button secondary small" onClick={() => patch({ stepSource: undefined })}>Keep this independent graphic</button>
        </div>}
        {source && stepNeedsReview(scene, graphic) && <div className="interaction-empty" role="status">
          <p>The learning step changed. Your graphic text and manual timing are preserved.</p>
          <button className="button secondary small" onClick={() => {
            const cue = cues.find(item => item.cue.kind === "step" && item.cue.id === source.id);
            if (cue) patch({ stepSource: { id: source.id, text: source.text, at: cue.at } });
          }}>Mark step suggestion reviewed</button>
        </div>}
        <details className="focus-appearance">
          <summary>Style and animation</summary>
          <label>Visual style<select aria-label="Visual style" value={graphic.style} onChange={event => {
            const style = event.target.value as FocusStyle;
            patch({ style, ink: FOCUS_STYLES[style].ink, paper: FOCUS_STYLES[style].paper });
          }}>{Object.entries(FOCUS_STYLES).map(([value, style]) => <option key={value} value={value}>{style.name}</option>)}</select></label>
          <div className="interaction-fields">
            <MediaNumber label="Graphic size" min={22} max={160} step={1} value={graphic.size} onChange={size => patch({ size })} />
            <MediaNumber label="Text size" min={16} max={34} step={1} value={graphic.textSize} onChange={textSize => patch({ textSize })} />
            <label>Foreground color<input type="color" value={graphic.ink} onChange={event => patch({ ink: event.target.value })} /></label>
            <label>Background color<input type="color" value={graphic.paper} onChange={event => patch({ paper: event.target.value })} /></label>
            <MediaNumber label="Fade in (seconds)" min={0} max={Math.min(1.5, graphic.length - graphic.fadeOut)}
              value={graphic.fadeIn} onChange={fadeIn => patch({ fadeIn })} />
            <MediaNumber label="Fade out (seconds)" min={0} max={Math.min(1.5, graphic.length - graphic.fadeIn)}
              value={graphic.fadeOut} onChange={fadeOut => patch({ fadeOut })} />
          </div>
          {canDrawFocus(graphic.kind) && <label className="world-check"><input type="checkbox" checked={graphic.reveal}
            onChange={event => patch({ reveal: event.target.checked })} /> Draw the graphic on gently</label>}
        </details>
      </div>
      <div className="interaction-review">
        <button className="button secondary" disabled={!!issue} onClick={() => { setPreview(value => value + 1); setReviewed(true); }}>Preview</button>
        {issue && <p className="interaction-empty" role="status">{issue}</p>}
        {contrast < 4.5 && <p className="interaction-empty" role="status">These colors may be hard to read. Try Simple High Contrast or choose a lighter background and darker foreground.</p>}
        {outside && <p className="interaction-empty" role="status">The target is out of frame at the start. The graphic appears when the target is visible.</p>}
        {overlapsCast && <p className="interaction-empty" role="status">This text may cover a character’s face or chest. Try a different position and preview the action.</p>}
        {layout.captionOverlap && <p className="interaction-empty" role="status">This position is near the caption area. Text is kept clear where possible. Move the target or review the position with captions on.</p>}
        {preview > 0 && !issue && <>
          <p role="status">{reviewed ? "Ready to apply after your review." : "Preview again before applying the latest edits."}</p>
          <label className="world-check"><input type="checkbox" checked={guide} onChange={event => setGuide(event.target.checked)} /> Show caption safe area</label>
          <ScenePreview key={preview} project={project} scene={proposed} precision={2} showCaptions captionGuide={guide}
            initialTime={Math.min(displayWindow.end - 0.001, displayWindow.start + 0.35)}
            onFocusPosition={pickPosition && target.kind !== "object" ? point => patch({ target: { kind: "screen", ...point } }) : undefined} />
          <p className="field-hint">Check faces, hands, and captions while the scene plays. Use a short phrase alongside the action or narration.</p>
        </>}
      </div>
    </div>
    {error && <p role="alert">{error}</p>}
    {remove && <div className="interaction-confirm" role="group" aria-label="Confirm removing graphic">
      <p>Remove this teaching graphic?</p>
      <button className="button secondary" onClick={() => setRemove(false)}>Keep it</button>
      <button className="button danger" onClick={() => { if (onApply({ focusGraphics: others })) onClose(); }}>Remove graphic</button>
    </div>}
    <div className="modal-actions">
      {original && !remove && <button className="button text" onClick={() => setRemove(true)}>Delete graphic</button>}
      <button className="button secondary" onClick={onClose}>Cancel</button>
      <button className="button primary" disabled={!!issue || !reviewed} onClick={apply}>Apply</button>
    </div>
  </Modal>;
}
