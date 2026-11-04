import { useState } from "react";
import type { ReactNode } from "react";
import { elementName, saveLibraryItem } from "../library";
import type { LibraryItem } from "../library";
import { INTERACTION_LABELS, interactionEvents } from "../interaction-model";
import { uid } from "../model";
import type { Asset, Project, Scene, SceneElement } from "../model";
import { appearancesFor, changeTime, MAX_CHANGES_PER_OBJECT, MAX_OBJECT_STATES, TRANSITIONS, transformable, transformIssue } from "../transform-model";
import type { ObjectChange, ObjectState, ObjectTrack, PropAppearance } from "../transform-model";
import { objectAppearanceAt } from "../transform-motion";
import { libraryArtworkFromState, newObjectTrack, stateArtworkFromLibrary } from "../transform-studio";
import { ArtLibrary } from "./ArtLibrary";
import { DrawingPad } from "./DrawingPad";
import { MediaNumber } from "./MediaNumber";
import { Modal } from "./Modal";
import { ScenePreview } from "./ScenePreview";
import { Stage } from "./Stage";

export const TRANSFORM_TITLE = "Show How Something Changes";

function freshChange(track: ObjectTrack, at: number, duration: number): ObjectChange {
  return { id: uid(), at: Math.max(0, Math.min(duration, Math.round(at * 100) / 100)),
    to: track.states.find(state => state.id !== track.initial)?.id ?? track.initial, transition: "cut", length: 0 };
}

function AppearancePreview({ project, scene, object, state, label }: {
  project: Project; scene: Scene; object: SceneElement; state?: ObjectState; label: string;
}) {
  if (!state) return null;
  const view: Scene = {
    ...scene, title: `${label} · ${state.name}`, transition: "cut", camera: "close",
    cameraAnimation: undefined, interactions: undefined, gentleDepth: undefined,
    backgroundAnimation: undefined, elements: [{ ...object, x: 400, y: 342, scale: 1.28, motion: "still",
      animation: undefined, sceneryDepth: undefined, rotation: object.rotation }],
    objectTracks: [{ objectId: object.id, initial: state.id, states: [state], changes: [] }],
  };
  return <figure><Stage project={project} scene={view} time={0} />
    <figcaption><strong>{label}</strong> · {state.name}</figcaption></figure>;
}

export function TransformStudio({ project, scene, objectId, changeId, time, onClose, onApply }: {
  project: Project; scene: Scene; objectId?: string; changeId?: string; time: number;
  onClose: () => void; onApply: (patch: Partial<Scene>, assets?: Asset[]) => boolean;
}) {
  const objects = scene.elements.filter(transformable);
  const [selected, setSelected] = useState(() => objects.find(item => item.id === objectId)?.id ?? objects[0]?.id ?? "");
  const object = objects.find(item => item.id === selected);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState("");
  if (!object) return <Modal title={TRANSFORM_TITLE} onClose={onClose}>
    <p>Add a prop, drawing or image from the Art Library, then return here. You can use scenery too.</p>
    <button className="button secondary" onClick={onClose}>Back to scene</button>
  </Modal>;
  const original = scene.objectTracks?.find(track => track.objectId === object.id);
  return <TransformForm key={object.id} project={project} scene={scene} object={object} original={original}
    changeId={object.id === objectId ? changeId : undefined} time={time} onClose={onClose} onApply={onApply}
    onDirty={() => setDirty(true)}
    objectChoice={<>
      <label>Choose an Object<select aria-label="Choose an Object" value={selected} onChange={event => {
        if (event.target.value === selected) return;
        if (dirty) setPending(event.target.value);
        else setSelected(event.target.value);
      }}>
        {objects.map(item => <option value={item.id} key={item.id}>{elementName(project, item)}</option>)}
      </select></label>
      {pending && <div role="group" aria-label="Confirm switching objects" className="interaction-confirm">
        <p>Switch objects and discard this unapplied draft?</p>
        <button className="button secondary" onClick={() => setPending("")}>Keep this draft</button>
        <button className="button secondary" onClick={() => { setSelected(pending); setPending(""); setDirty(false); }}>Switch objects</button>
      </div>}
    </>} />;
}

function TransformForm({ project, scene, object, original, changeId, time, objectChoice, onDirty, onClose, onApply }: {
  project: Project; scene: Scene; object: SceneElement; original?: ObjectTrack; changeId?: string; time: number;
  objectChoice: ReactNode; onDirty: () => void; onClose: () => void;
  onApply: (patch: Partial<Scene>, assets?: Asset[]) => boolean;
}) {
  const [track, setTrack] = useState(() => original ?? newObjectTrack(object));
  const [change, setChange] = useState(() => original?.changes.find(item => item.id === changeId) ?? freshChange(track, time, scene.duration));
  const [editing, setEditing] = useState(change.to);
  const [assets, setAssets] = useState(project.assets);
  const [picker, setPicker] = useState<"library" | "draw">();
  const [reviewed, setReviewed] = useState(false);
  const [compare, setCompare] = useState(false);
  const [remove, setRemove] = useState<"change" | "state" | "track">();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [savingArt, setSavingArt] = useState(false);
  const state = track.states.find(item => item.id === editing);
  const at = changeTime(scene, track, change);
  const priorTrack = { ...track, changes: track.changes.filter(item => item.id !== change.id) };
  const start = objectAppearanceAt(scene, priorTrack, at - 0.000001).state;
  const finish = track.states.find(item => item.id === change.to);
  const source = assets.find(asset => asset.id === (state?.art.kind === "image" ? state.art.assetId :
    state?.art.kind === "original" ? object.assetId : undefined));
  const projectView = { ...project, assets };
  const replaceTrack = (next: ObjectTrack) => [...(scene.objectTracks ?? []).filter(item => item.objectId !== object.id), next];
  const nextTrack = { ...track, changes: [...track.changes.filter(item => item.id !== change.id), change] };
  const candidate = { ...scene, objectTracks: replaceTrack(nextTrack) };
  const issue = transformIssue(candidate.objectTracks, candidate, new Set(assets.map(asset => asset.id))) ??
    (!start || !finish || start.id === finish.id || JSON.stringify(start.art) === JSON.stringify(finish.art)
      ? "Choose two visibly different appearances for the starting state and this change." : undefined);
  const attachedTimes = (scene.interactions ?? []).filter(action => action.objectId === object.id)
    .flatMap(action => interactionEvents(action).map(event => ({
      key: JSON.stringify([action.id, event.name]), at: event.time,
      name: `${INTERACTION_LABELS[action.kind]} · ${event.name} at ${event.time.toFixed(2)} s`,
      cue: { interactionId: action.id, moment: event.name },
    })));
  const cueKey = change.cue ? JSON.stringify([change.cue.interactionId, change.cue.moment]) : "";

  function unreview() { setReviewed(false); setError(""); onDirty(); }
  function patchChange(patch: Partial<ObjectChange>) { setChange(value => ({ ...value, ...patch })); unreview(); }
  function patchState(patch: Partial<Omit<ObjectState, "id">>) {
    setTrack(value => ({ ...value, states: value.states.map(item => item.id === editing ? { ...item, ...patch } : item) }));
    unreview();
  }
  function selectLibrary(item: LibraryItem) {
    const next = [...assets];
    const art = stateArtworkFromLibrary(item, next);
    setAssets(next);
    patchState({ art });
    setPicker(undefined);
  }
  function saveDrawing(asset: Asset, name: string) {
    const next = [...assets, asset];
    setAssets(next);
    patchState({ art: { kind: "image", assetId: asset.id }, name: name.slice(0, 60) || state?.name });
    setPicker(undefined);
  }
  async function saveArtwork() {
    if (!state || savingArt) return;
    setSavingArt(true);
    setError("");
    try {
      await saveLibraryItem(libraryArtworkFromState(projectView, object, state), true);
      setNotice(`Saved ${state.name} to your Art Library. The scene still needs Apply.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This artwork could not be saved.");
    } finally { setSavingArt(false); }
  }
  function apply() {
    if (issue || !reviewed) return;
    const references = new Set(candidate.objectTracks.flatMap(item => item.states.flatMap(value =>
      value.art.kind === "image" ? [value.art.assetId] : [])));
    const included = assets.filter(asset => project.assets.includes(asset) || references.has(asset.id));
    if (onApply({ objectTracks: candidate.objectTracks }, included)) onClose();
    else setError("The change could not be saved. Check the artwork and project limits.");
  }
  const stateOptions = track.states.map(item => <option key={item.id} value={item.id}>{item.name || "Unnamed appearance"}</option>);
  if (picker === "library") return <ArtLibrary onClose={() => setPicker(undefined)} onUse={selectLibrary}
    initialKind="prop" onPuppet={() => {}} acceptAppearance={item =>
      !!item.assetId || !!item.propAppearance && item.prop === object.prop} />;
  if (picker === "draw") return <DrawingPad onClose={() => setPicker(undefined)} onSave={saveDrawing}
    name={state?.name} initial={source?.drawing} saveLabel="Use drawing as this appearance" />;
  return <Modal title={TRANSFORM_TITLE} onClose={onClose} wide>
    <p className="field-hint">Change one object’s artwork while keeping its placement and movement. Review before applying.</p>
    <div className="interaction-layout">
      <div className="interaction-controls">
        {objectChoice}
        <div className="interaction-fields">
          <label>Show Before<select aria-label="Show Before" value={track.initial} onChange={event => {
            setTrack(value => ({ ...value, initial: event.target.value })); unreview();
          }}>{stateOptions}</select></label>
          <label>Show After<select aria-label="Show After" value={change.to} onChange={event => {
            setEditing(event.target.value); patchChange({ to: event.target.value });
          }}>{stateOptions}</select></label>
        </div>
        {!!priorTrack.changes.length && <p className="field-hint">The scene starts with the Before selection. The preview shows the appearance just before this timed change.</p>}
        <details className="appearance-details">
          <summary>Manage named appearances</summary>
          <label>Edit appearance<select value={editing} onChange={event => setEditing(event.target.value)}>{stateOptions}</select></label>
          {state && <>
            <label>Appearance name<input maxLength={60} value={state.name} onChange={event => patchState({ name: event.target.value })} /></label>
            <label>Appearance artwork<select value={state.art.kind === "prop" ? state.art.appearance : state.art.kind}
              onChange={event => {
                if (event.target.value === "original") patchState({ art: { kind: "original" } });
                else if (event.target.value !== "image") patchState({ art: { kind: "prop", appearance: event.target.value as PropAppearance } });
              }}>
              <option value="original">Original object artwork</option>
              {state.art.kind === "image" && <option value="image">{source?.name ?? "Scene artwork"}</option>}
              {appearancesFor(object.prop).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
            </select></label>
            {project.assets.length > 0 && <label>Use an image already in this project<select value=""
              onChange={event => { if (event.target.value) patchState({ art: { kind: "image", assetId: event.target.value } }); }}>
              <option value="">Choose existing artwork</option>
              {project.assets.map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
            </select></label>}
            <div className="series-actions">
              <button className="button secondary small" onClick={() => setPicker("library")}>Choose artwork from my library</button>
              <button className="button secondary small" onClick={() => setPicker("draw")}>
                {source?.drawing ? "Edit a copy of the artwork" : "Draw replacement artwork"}
              </button>
              <button className="button text small" onClick={() => patchState({ art: { kind: "original" } })}>Restore original appearance</button>
              <button className="button text small" disabled={savingArt || !state.name.trim()} onClick={() => void saveArtwork()}>Save appearance to Art Library</button>
            </div>
          </>}
          <div className="series-actions">
            <button className="button secondary small" disabled={track.states.length >= MAX_OBJECT_STATES} onClick={() => {
              const value: ObjectState = { id: uid(), name: `Appearance ${track.states.length + 1}`, art: { kind: "original" } };
              setTrack(item => ({ ...item, states: [...item.states, value] }));
              setEditing(value.id); unreview();
            }}>Add named appearance</button>
            <button className="button text small" disabled={!state || editing === track.initial || editing === change.to ||
              track.changes.some(item => item.id !== change.id && item.to === editing)} onClick={() => setRemove("state")}>Delete unused appearance</button>
          </div>
          <p className="field-hint">Four appearances per object. A project copy keeps its artwork if the library original changes.</p>
        </details>
        {attachedTimes.length > 0 && <label>Link to a character action<select value={cueKey}
          onChange={event => {
            const choice = attachedTimes.find(item => item.key === event.target.value);
            patchChange({ cue: choice?.cue, at: choice?.at ?? at });
          }}>
          <option value="">Set my own time</option>
          {attachedTimes.map(item => <option value={item.key} key={item.key}>{item.name}</option>)}
        </select></label>}
        {change.cue ? <p className="field-hint">Changes at {at.toFixed(2)} seconds and follows that action if its timing moves.</p> :
          <MediaNumber label="Change at This Time (seconds)" min={0} max={scene.duration} value={change.at} onChange={at => patchChange({ at })} />}
        <label>Transition<select value={change.transition} onChange={event => {
          const transition = event.target.value as ObjectChange["transition"];
          patchChange({ transition, length: transition === "cut" ? 0 : change.length || 0.4 });
        }}>{Object.entries(TRANSITIONS).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        {change.transition !== "cut" && <MediaNumber label="Transition length (seconds)" min={0.01} max={1.5}
          value={change.length} onChange={length => patchChange({ length })} />}
        <label className="world-check"><input type="checkbox" checked={!!change.sparkle}
          onChange={event => patchChange({ sparkle: event.target.checked })} /> Add a small completion star</label>
        {track.changes.length >= MAX_CHANGES_PER_OBJECT && !changeId && <p>Remove an earlier change before adding another.</p>}
      </div>
      <div className="interaction-review">
        <div className="appearance-comparison">
          <AppearancePreview project={projectView} scene={scene} object={object} state={start} label="Before" />
          <AppearancePreview project={projectView} scene={scene} object={object} state={finish} label="After" />
        </div>
        <div className="series-actions">
          <button className="button secondary" disabled={!!issue} onClick={() => { setReviewed(true); setCompare(false); }}>Preview the Change</button>
          {reviewed && <button className="button text" onClick={() => setCompare(value => !value)}>
            {compare ? "Show proposed change" : "Compare current scene"}
          </button>}
        </div>
        {issue && <p className="interaction-empty" role="status">{issue}</p>}
        {reviewed && !issue && <>
          <p role="status">{compare ? "Current scene" : "Proposed change. Ready to apply."}</p>
          <ScenePreview project={projectView} scene={compare ? scene : candidate} precision={2} initialTime={Math.max(0, at - 0.4)} />
        </>}
      </div>
    </div>
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert">{error}</p>}
    {remove && <div className="interaction-confirm" role="group" aria-label="Confirm removal">
      <p>{remove === "track" ? "Restore this object’s original artwork and remove its appearance changes? Other animation stays." :
        remove === "change" ? "Remove this timed change? The artwork and other animation stay." : "Remove this unused appearance?"}</p>
      <button className="button secondary" onClick={() => setRemove(undefined)}>Keep it</button>
      <button className="button danger" onClick={() => {
        if (remove === "track") {
          if (onApply({ objectTracks: scene.objectTracks?.filter(item => item.objectId !== object.id) })) onClose();
        } else if (remove === "change" && original) {
          if (onApply({ objectTracks: replaceTrack({ ...original, changes: original.changes.filter(item => item.id !== change.id) }) })) onClose();
        } else if (remove === "state" && state) {
          setTrack(value => ({ ...value, states: value.states.filter(item => item.id !== state.id) }));
          setEditing(track.initial); unreview(); setRemove(undefined);
        }
      }}>{remove === "track" ? "Restore object artwork" : remove === "change" ? "Remove change" : "Remove appearance"}</button>
    </div>}
    <div className="modal-actions">
      {original && !remove && <button className="button text" onClick={() => setRemove("track")}>Restore the original object</button>}
      {changeId && !remove && <button className="button text" onClick={() => setRemove("change")}>Delete timed change</button>}
      <button className="button secondary" onClick={onClose}>Cancel</button>
      <button className="button primary" disabled={!!issue || !reviewed} onClick={apply}>Apply</button>
    </div>
  </Modal>;
}
