import { useRef, useState } from "react";
import type { PointerEvent } from "react";
import { LITTLE_FIXERS_OPENING_ACTION } from "../little-fixers-opening-script";
import type { Crop } from "../art-model";
import { downloadBlob, readImage } from "../files";
import { imageLibraryItem, saveLibraryItem } from "../library";
import type { LibraryItem } from "../library";
import type { Asset, Project } from "../model";
import {
  cropBetween, defaultPanel, editCrop, fixersPanels, loadFixersPoster, MAX_MASKS, MAX_POINTS,
  newPictureProject, pictureCutout, pictureImage, picturePuppet, sourcePanel,
} from "../picture-studio";
import type { Cutout, Mask, Panel, Point, PreparedPart } from "../picture-studio";
import type { PartRole } from "../puppet-model";
import { clamp } from "../timeline";
import { Modal } from "./Modal";

const roleChoices: ReadonlyArray<[PartRole, string]> = [
  ["torso", "Body"], ["head", "Head"], ["leftArm", "Left arm"], ["rightArm", "Right arm"],
  ["leftLeg", "Left leg"], ["rightLeg", "Right leg"], ["leftHand", "Left hand"], ["rightHand", "Right hand"],
  ["eyes", "Eyes"], ["mouth", "Mouth"], ["artwork", "Whole character"],
];
const percent = (value: number) => Math.round(value * 1000) / 10;

type Selection = { panel: Panel; masks: Mask[]; points: Point[] };
interface History { past: Selection[]; present: Selection; future: Selection[] }

export function PictureStudio({ project, sceneIndex, onClose, onCreate, onPanel, onPuppet, onProp, onDemo, onOpening, onFullScript, onSafetyPreview }: {
  project?: Project;
  sceneIndex?: number;
  onClose: () => void;
  onCreate: (project: Project) => Promise<void>;
  onPanel: (index: number, source: Asset, panel: Panel) => void;
  onPuppet: (index: number, item: LibraryItem) => void;
  onProp: (index: number, item: LibraryItem) => void;
  onDemo: (asset: Asset) => Promise<void>;
  onOpening: (asset: Asset) => Promise<void>;
  onFullScript: (asset: Asset) => Promise<void>;
  onSafetyPreview: (asset: Asset) => Promise<void>;
}) {
  const [index, setIndex] = useState(sceneIndex ?? 0);
  const [source, setSource] = useState(() => project?.assets.find(asset => asset.id === project.pictureSourceId));
  const [fixers, setFixers] = useState(() => project?.templateId === "little-fixers-picture");
  const [mode, setMode] = useState<"panel" | "cutout">("panel");
  const [history, setHistory] = useState<History>(() => ({
    present: { panel: project ? sourcePanel(project, index) : defaultPanel, masks: [], points: [] }, past: [], future: [],
  }));
  const { panel, masks, points } = history.present;
  const [drag, setDrag] = useState<{ start: Point; end: Point }>();
  const dragStart = useRef<Point | null>(null);
  const [zoom, setZoom] = useState(1);
  const [subtract, setSubtract] = useState(false);
  const [pointIndex, setPointIndex] = useState(0);
  const [cutout, setCutout] = useState<Cutout>();
  const [name, setName] = useState("My picture character");
  const [role, setRole] = useState<PartRole>("torso");
  const [parts, setParts] = useState<PreparedPart[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const width = source?.sourceWidth ?? 800, height = source?.sourceHeight ?? 450;
  const crop = drag ? cropBetween(drag.start, drag.end) : panel.crop;

  function change(changes: Partial<Selection>) {
    setHistory(old => ({
      past: [...old.past.slice(-39), old.present], present: { ...old.present, ...changes }, future: [],
    }));
    if (changes.masks || changes.points) setCutout(undefined);
  }

  function travel(undo: boolean) {
    setCutout(undefined);
    setHistory(old => {
      const next = undo ? old.past.at(-1) : old.future[0];
      if (!next) return old;
      return undo
        ? { present: next, past: old.past.slice(0, -1), future: [old.present, ...old.future] }
        : { present: next, past: [...old.past, old.present], future: old.future.slice(1) };
    });
  }

  async function run(action: () => void | Promise<void>) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "This picture change could not be saved."); }
    finally { working.current = false; setBusy(false); }
  }

  function reset(next: Panel) {
    setHistory({ present: { panel: next, masks: [], points: [] }, past: [], future: [] });
    setCutout(undefined);
  }

  function selectPicture(asset: Asset, example: boolean) {
    setSource(asset);
    setFixers(example);
    setZoom(1);
    setParts([]);
    reset(example ? fixersPanels[0] : defaultPanel);
  }

  function pointerPosition(event: PointerEvent<SVGSVGElement>): Point {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: clamp((event.clientX - bounds.left) / bounds.width, 0, 1),
      y: clamp((event.clientY - bounds.top) / bounds.height, 0, 1) };
  }

  function addPoint(point: Point) {
    if (points.length >= MAX_POINTS) return;
    setPointIndex(points.length);
    change({ points: [...points, point] });
  }

  function finishOutline() {
    if (points.length < 3 || masks.length === MAX_MASKS) return;
    change({ masks: [...masks, { points, subtract }], points: [] });
    setPointIndex(0);
  }

  function pointString(path: Point[]) {
    return path.map(point => `${point.x * width},${point.y * height}`).join(" ");
  }

  async function preview() {
    if (!source) return;
    if (points.length > 0 && points.length < 3) throw new Error("Add at least three points to close the outline.");
    const selection = points.length ? [...masks, { points, subtract }] : masks;
    const result = await pictureCutout(await pictureImage(source), selection, name.trim() || "Picture cutout");
    if (points.length) finishOutline();
    setCutout(result);
  }

  return <Modal title="Turn My Picture Into a Cartoon" onClose={() => { if (!busy) onClose(); }} wide>
    <p className="section-description">Choose a picture panel for your storyboard. Trace separate pieces to make a character or prop move. Finish dialogue, sound, and video in the cartoon editor.</p>
    <fieldset className="picture-fields" disabled={busy}>
      <legend className="visually-hidden">Picture tools</legend>
      {!project && <div className="animation-actions">
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" aria-label="Original picture file"
          className="visually-hidden" tabIndex={-1} onChange={event => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void run(async () => selectPicture(await readImage(file), false));
          }} />
        <button className="button secondary" onClick={() => input.current?.click()}>{source ? "Choose different picture" : "Upload original picture"}</button>
        <button className="button secondary" onClick={() => void run(async () => selectPicture(await loadFixersPoster(), true))}>Use the Little Fixers Club poster</button>
      </div>}
      {!source && <p className="field-hint">PNG, JPEG or WebP up to 4 MB and 24 megapixels. Edits are saved separately from the original.</p>}
      {source && <>
        <div className="animation-actions">
          <button className="button secondary" onClick={() => void run(async () => {
            downloadBlob(await (await fetch(source.dataUrl)).blob(), source.name);
            setMessage("Original picture downloaded.");
          })}>Download original picture</button>
          {project && <button className="button secondary" aria-pressed={mode === "cutout"}
            onClick={() => setMode(mode === "panel" ? "cutout" : "panel")}>
            {mode === "panel" ? "Make This Character Move" : "Edit storyboard panel"}
          </button>}
          <button className="button secondary small" disabled={!history.past.length} onClick={() => travel(true)}>Undo picture edit</button>
          <button className="button secondary small" disabled={!history.future.length} onClick={() => travel(false)}>Redo picture edit</button>
        </div>
        <div className="property-fields picture-grid">
          <label>Picture zoom <select value={zoom} onChange={event => setZoom(Number(event.target.value))}>
            <option value={1}>Fit picture</option><option value={2}>2×</option><option value={3}>3×</option>
          </select></label>
          {project && <label>Storyboard scene <select value={index} onChange={event => {
            const next = Number(event.target.value);
            setIndex(next);
            reset(sourcePanel(project, next));
          }}>{project.scenes.map((scene, i) => <option key={scene.id} value={i}>{i + 1}. {scene.title}</option>)}</select></label>}
          {fixers && mode === "panel" && <label>Suggested poster panels <select value="" onChange={event => {
            if (event.target.value !== "") change({ panel: { ...fixersPanels[Number(event.target.value)], visible: panel.visible } });
          }}><option value="">Choose a suggestion</option>
            {fixersPanels.map((item, i) => <option key={item.name} value={i}>{item.name}</option>)}
          </select></label>}
        </div>
        <p className="field-hint">{mode === "panel" ? "Drag across the picture at fit zoom to outline a panel, or edit the measurements below." :
          "Tap or click corners around a piece of artwork. For keyboard editing, add a point below and enter its position. Use the scroll area at higher zoom."}</p>
        <div className="picture-scroll" tabIndex={0} aria-label="Scrollable picture canvas">
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: `${zoom * 100}%` }}
            className={zoom === 1 ? "picture-canvas fit" : "picture-canvas"}
            role="img" aria-label="Original picture and selection"
            onPointerDown={event => {
              if (event.button !== 0 || (mode === "panel" && zoom !== 1)) return;
              const start = pointerPosition(event);
              dragStart.current = start;
              if (mode === "panel") {
                event.currentTarget.setPointerCapture(event.pointerId);
                setDrag({ start, end: start });
              }
            }}
            onPointerMove={event => {
              if (mode === "panel" && dragStart.current) setDrag({ start: dragStart.current, end: pointerPosition(event) });
            }}
            onPointerUp={event => {
              const start = dragStart.current, end = pointerPosition(event);
              if (!start) return;
              dragStart.current = null;
              setDrag(undefined);
              const moved = Math.hypot(start.x - end.x, start.y - end.y) > 0.015;
              if (mode === "panel" && moved) change({ panel: { ...panel, crop: cropBetween(start, end) } });
              if (mode === "cutout" && !moved) addPoint(end);
            }}
            onPointerCancel={() => { dragStart.current = null; setDrag(undefined); }}>
            <image href={source.dataUrl} width={width} height={height} />
            {mode === "panel" && <rect className="picture-outline" x={crop.left * width} y={crop.top * height}
              width={crop.width * width} height={crop.height * height} vectorEffect="non-scaling-stroke" />}
            {mode === "cutout" && <>
              {masks.map((mask, i) => <polygon key={i} className={mask.subtract ? "picture-outline subtract" : "picture-outline"}
                points={pointString(mask.points)} vectorEffect="non-scaling-stroke" />)}
              <polyline className={subtract ? "picture-outline subtract" : "picture-outline"} points={pointString(points)} vectorEffect="non-scaling-stroke" />
              {points.map((point, i) => <circle key={i} className={i === pointIndex ? "picture-point active" : "picture-point"}
                cx={point.x * width} cy={point.y * height} r={Math.max(width, height) / (100 * zoom)} />)}
            </>}
          </svg>
        </div>
        {mode === "panel" ? <>
          <div className="property-fields picture-grid">
            <label>Panel name <input maxLength={80} value={panel.name} onChange={event => change({ panel: { ...panel, name: event.target.value } })} /></label>
            <label>Rotation in degrees <input type="number" min={-180} max={180} value={panel.rotation}
              onChange={event => change({ panel: { ...panel, rotation: clamp(Number(event.target.value), -180, 180) } })} /></label>
            {(["left", "top", "width", "height"] as (keyof Crop)[]).map(field => <label key={field}>Panel {field} (%)
              <input type="number" min={0} max={100} step={0.1} value={percent(panel.crop[field])}
                onChange={event => change({ panel: { ...panel, crop: editCrop(panel.crop, field, Number(event.target.value) / 100) } })} />
            </label>)}
          </div>
          <label className="picture-check"><input type="checkbox" checked={panel.visible} onChange={event =>
            change({ panel: { ...panel, visible: event.target.checked } })} /> Show panel as a scene background</label>
          <p className="field-hint">Leave the panel hidden to use it only as a reference. Any people or objects printed inside a visible background stay still.</p>
          <div className="animation-actions">
            {project ? <button className="button primary" onClick={() => void run(() => onPanel(index, source, panel))}>Save panel to scene</button> : <>
              <button className="button primary" onClick={() => void run(() => onCreate(newPictureProject(source, panel, false)))}>Create storyboard scene</button>
              {fixers && <>
                <button className="button secondary" onClick={() => void run(() => onCreate(newPictureProject(source, panel, true)))}>Open the editable 20-minute plan</button>
                <button className="button secondary" onClick={() => void run(() => onDemo(source))}>Open the animated workshop demo</button>
                <button className="button secondary" onClick={() => void run(() => onOpening(source))}>
                  {LITTLE_FIXERS_OPENING_ACTION}
                </button>
                <button className="button secondary" onClick={() => void run(() => onSafetyPreview(source))}>
                  Open animated Safety First (3:00; new voice to record)
                </button>
                <button className="button secondary" onClick={() => void run(() => onFullScript(source))}>
                  Open full 20-minute script draft (unfinished animation)
                </button>
              </>}
            </>}
          </div>
        </> : <>
          <div className="property-fields picture-grid">
            <label>Outline operation <select value={subtract ? "remove" : "add"} onChange={event => setSubtract(event.target.value === "remove")}>
              <option value="add">Add or restore area</option><option value="remove">Remove area</option>
            </select></label>
            <label>Outline point <select value={Math.min(pointIndex, points.length - 1)} disabled={!points.length}
              onChange={event => setPointIndex(Number(event.target.value))}>{points.map((_, i) => <option key={i} value={i}>Point {i + 1}</option>)}</select></label>
            {points[pointIndex] && (["x", "y"] as const).map(axis => <label key={axis}>Point {axis.toUpperCase()} (%)
              <input type="number" min={0} max={100} step={0.1} value={percent(points[pointIndex][axis])}
                onChange={event => change({ points: points.map((point, i) =>
                  i === pointIndex ? { ...point, [axis]: clamp(Number(event.target.value) / 100, 0, 1) } : point) })} />
            </label>)}
          </div>
          <div className="animation-actions">
            <button className="button secondary small" disabled={points.length >= MAX_POINTS} onClick={() => addPoint({ x: 0.5, y: 0.5 })}>Add outline point</button>
            <button className="button secondary small" disabled={!points[pointIndex]} onClick={() => {
              change({ points: points.filter((_, i) => i !== pointIndex) }); setPointIndex(Math.max(0, pointIndex - 1));
            }}>Remove selected point</button>
            <button className="button secondary small" disabled={points.length < 3 || masks.length >= MAX_MASKS} onClick={finishOutline}>Close outline</button>
            <button className="button secondary small" disabled={!masks.length && !points.length} onClick={() => change({ masks: [], points: [] })}>Clear outlines</button>
            <button className="button primary small" onClick={() => void run(preview)}>Preview transparent cutout</button>
          </div>
          <p className="field-hint">Undo a closed outline to refine its points. Hidden limbs need separate drawings or uploads in Puppet Maker. Flat eyes and mouths stay still until you supply compatible face artwork.</p>
          <div className="property-fields picture-grid">
            <label>Character or prop name <input maxLength={80} value={name} onChange={event => setName(event.target.value)} /></label>
            <label>Prepare as a body part <select value={role} onChange={event => setRole(event.target.value as PartRole)}>
              {roleChoices.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select></label>
          </div>
          {cutout && <div className="picture-cutout">
            <img src={cutout.asset.dataUrl} alt="Transparent cutout preview" />
          </div>}
          <div className="animation-actions">
            <button className="button secondary" disabled={!cutout} onClick={() => {
              if (!cutout) return;
              setParts(items => [...items.filter(item => item.role !== role), { role, cutout }]);
              setMessage(`Prepared ${roleChoices.find(([id]) => id === role)?.[1]}.`);
              change({ masks: [], points: [] });
            }}>Keep this body part</button>
            <button className="button secondary" disabled={!cutout} onClick={() => void run(async () => {
              if (!cutout) return;
              const item = imageLibraryItem(cutout.asset, name.trim() || "Picture prop", "prop");
              await saveLibraryItem(item, true);
              setMessage(`Saved ${item.name} to the Art Library.`);
            })}>Save cutout as a prop</button>
            <button className="button secondary" disabled={!cutout} onClick={() => void run(() => {
              if (cutout) onProp(index, imageLibraryItem(cutout.asset, name.trim() || "Picture prop", "prop"));
            })}>Add prop to scene</button>
          </div>
          {parts.length > 0 && <ul className="picture-parts">
            {parts.map(item => <li key={item.role}>
              <img src={item.cutout.asset.dataUrl} alt="" />
              {roleChoices.find(([id]) => id === item.role)?.[1]}
              <button className="button text small" onClick={() => setParts(parts.filter(other => other.role !== item.role))}>
                Remove {roleChoices.find(([id]) => id === item.role)?.[1]}
              </button>
            </li>)}
          </ul>}
          <button className="button primary" disabled={!parts.length}
            onClick={() => void run(() => onPuppet(index, picturePuppet(name, parts)))}>
            Continue in Puppet Maker
          </button>
        </>}
      </>}
    </fieldset>
    {busy && <p role="status">Preparing your picture…</p>}
    {message && <p role="status">{message}</p>}
    {error && <p className="error-message" role="alert">{error}</p>}
    <div className="modal-actions"><button className="button secondary" disabled={busy} onClick={onClose}>Cancel</button></div>
  </Modal>;
}
