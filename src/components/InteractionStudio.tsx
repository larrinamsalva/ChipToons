import { useState } from "react";
import { propLabel } from "../art-model";
import type { PropName } from "../art-model";
import {
  HANDS, HAND_LABELS, INTERACTION_LABELS, LEARNING_ACTIONS, canBecomeStoryObject,
  interactionCharacter, interactionIssue, needsRelease, storyObject,
} from "../interaction-model";
import type { Grip, Hand, Interaction, InteractionKind } from "../interaction-model";
import { anchorDescription } from "../interaction-motion";
import { addStoryProp, canWalkForAction, newInteraction, storyPropOptions, walkForAction } from "../interaction-studio";
import type { InteractionSuggestion } from "../interaction-studio";
import { elementName, resolvedCharacter } from "../library";
import type { Project, Scene } from "../model";
import { MediaNumber } from "./MediaNumber";
import { Modal } from "./Modal";
import { ScenePreview } from "./ScenePreview";

export const INTERACTION_TITLE = "Make My Character Do Something";

export function InteractionStudio({ project, scene, current, time, selectedId, suggestion, previewScene, onClose, onApply }: {
  project: Project; scene: Scene; current?: Interaction; time: number; selectedId?: string;
  suggestion?: InteractionSuggestion; previewScene?: (scene: Scene) => Scene; onClose: () => void; onApply: (patch: Partial<Scene>) => boolean | void;
}) {
  const [elements, setElements] = useState(scene.elements);
  const [draft, setDraft] = useState(() => {
    const actor = scene.elements.find(item => item.id === (suggestion?.actorId ?? selectedId) && interactionCharacter(item)) ??
      scene.elements.find(interactionCharacter);
    const prop = scene.elements.find(item => item.id === suggestion?.objectId) ??
      (!suggestion ? scene.elements.find(storyObject) : undefined);
    const receiver = scene.elements.find(item => interactionCharacter(item) && item.id !== actor?.id);
    return current ?? newInteraction(scene, suggestion?.kind ?? "pickup", time, actor?.id, prop?.id, receiver?.id);
  });
  const [addProp, setAddProp] = useState<PropName>(suggestion?.prop ?? "book");
  const [example, setExample] = useState("");
  const [walk, setWalk] = useState(suggestion?.kind === "carry");
  const [review, setReview] = useState(false);
  const [compare, setCompare] = useState(false);
  const [markers, setMarkers] = useState(true);
  const [remove, setRemove] = useState(false);
  const [error, setError] = useState("");
  const actors = elements.filter(interactionCharacter);
  const prop = elements.find(item => item.id === draft.objectId);
  const actor = actors.find(item => item.id === draft.actorId);
  const receiver = actors.find(item => item.id === draft.transfer?.actorId);
  const actionList = [...(scene.interactions ?? []).filter(action => action.id !== draft.id), draft];
  const issue = interactionIssue(actionList, scene.duration, elements);
  const compatibleWalk = !previewScene && canWalkForAction(actor) && draft.kind !== "point";
  const proposedElements = walk && !issue && compatibleWalk && actor
    ? elements.map(item => item === actor ? walkForAction(project, actor, { ...scene, elements }, draft) : item) : elements;
  const proposed = { ...scene, elements: proposedElements, interactions: actionList };
  const displayed = compare ? scene : review && previewScene ? previewScene(proposed) : proposed;

  function patch(change: Partial<Interaction>) {
    setDraft(value => ({ ...value, ...change }));
    setReview(false);
    setError("");
  }
  function chooseKind(kind: InteractionKind, objectId = draft.objectId) {
    const next = newInteraction({ ...scene, elements }, kind, draft.start, draft.actorId, objectId,
      actors.find(item => item.id !== draft.actorId)?.id);
    if (kind === "carry" || kind === "move" || kind === "water") setWalk(true);
    patch({ ...next, id: draft.id, grip: { ...draft.grip, y: next.grip.y } });
  }
  function insert() {
    const existing = elements.find(item => storyObject(item) && item.prop === addProp);
    if (existing) {
      patch({ objectId: existing.id });
      return;
    }
    try {
      const next = addStoryProp(project, { ...scene, elements }, addProp);
      setElements(next.elements);
      const item = next.elements.at(-1)!;
      patch({ objectId: item.id });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The prop could not be added.");
    }
  }
  function gripFields(grip: Grip, name: string, chosen: typeof actor, change: (value: Grip) => void) {
    return (
      <div className="interaction-grip">
        <label>{name}<select value={grip.hand} onChange={event => change({ ...grip, hand: event.target.value as Hand })}>
          {HANDS.map(hand => <option key={hand} value={hand}>{HAND_LABELS[hand]}</option>)}
        </select></label>
        <p className="field-hint">{anchorDescription(resolvedCharacter(project, chosen), chosen, grip.hand)}</p>
        <div className="interaction-fields">
          <MediaNumber label={`${name} offset X`} min={-120} max={120} value={grip.x} onChange={x => change({ ...grip, x })} />
          <MediaNumber label={`${name} offset Y`} min={-120} max={120} value={grip.y} onChange={y => change({ ...grip, y })} />
        </div>
      </div>
    );
  }
  function apply() {
    if (issue || !review) return;
    try {
      if (onApply({ elements: proposed.elements, interactions: actionList }) !== false) onClose();
      else setError("This edit could not be saved. Review the scene limits and try again.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This edit could not be applied.");
    }
  }
  const chooseObject = elements.filter(canBecomeStoryObject);
  const transfer = draft.transfer;
  const release = draft.release;
  return (
    <Modal title={INTERACTION_TITLE} onClose={onClose} wide>
      <p className="field-hint">Choose who acts, what they use, and when it happens. Preview as often as you like before applying.</p>
      {!actors.length && <p role="status">Add a character to this scene through the Art Library, then come back here.</p>}
      {suggestion && <p className="field-hint">Story suggestion: {INTERACTION_LABELS[suggestion.kind]} · {propLabel(suggestion.prop)}.
        {!suggestion.alreadyPresent && " Add the suggested prop below, or choose one you already have."}</p>}
      <div className="interaction-layout">
        <div className="interaction-controls">
          {!current && <details><summary>Try a learning action</summary>
            <label>Learning example<select value={example} onChange={event => {
              const sample = LEARNING_ACTIONS.find(item => item[0] === event.target.value);
              setExample(event.target.value);
              if (!sample) return;
              setAddProp(sample[2]);
              chooseKind(sample[1], elements.find(item => storyObject(item) && item.prop === sample[2])?.id ?? "");
            }}>
              <option value="">Choose an example</option>
              {LEARNING_ACTIONS.map(([title]) => <option key={title}>{title}</option>)}
            </select></label>
            {example && <p className="field-hint">{LEARNING_ACTIONS.find(item => item[0] === example)?.[3]}</p>}
          </details>}
          <label>Choose Character<select value={draft.actorId} onChange={event => patch({ actorId: event.target.value,
            ...(transfer && transfer.actorId === event.target.value ? { transfer: { ...transfer, actorId: "" } } : {}),
          })}>
            <option value="">Choose a character</option>
            {actors.map(item => <option key={item.id} value={item.id}>{elementName(project, item)} · {actors.indexOf(item) + 1}</option>)}
          </select></label>
          <label>Choose Object<select value={draft.objectId} onChange={event => patch({ objectId: event.target.value })}>
            <option value="">Choose a story object</option>
            {chooseObject.map((item, index) => <option key={item.id} value={item.id}>
              {elementName(project, item)} · {index + 1}{item.sceneryDepth ? " (scenery)" : ""}
            </option>)}
          </select></label>
          {prop?.sceneryDepth && <button className="button secondary small" onClick={() => {
            setElements(elements.map(item => item === prop ? { ...item, sceneryDepth: undefined } : item));
            setReview(false);
          }}>Use this scene copy as a story prop</button>}
          <div className="interaction-add">
            <label>Original story prop<select value={addProp} onChange={event => setAddProp(event.target.value as PropName)}>
              {storyPropOptions().map(item => <option key={item.id} value={item.prop}>{item.name}</option>)}
            </select></label>
            <button className="button secondary small" onClick={insert}>Add story prop</button>
          </div>
          <label>Interaction<select aria-label="Interaction" value={draft.kind} onChange={event => chooseKind(event.target.value as InteractionKind)}>
            {Object.entries(INTERACTION_LABELS).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}
          </select></label>
          {transfer && <label>{draft.kind === "receive" ? "Who receives the object?" : "Give to which friend?"}
            <select value={transfer.actorId} onChange={event => patch({ transfer: { ...transfer, actorId: event.target.value } })}>
              <option value="">Choose a friend</option>
              {actors.filter(item => item.id !== draft.actorId).map(item => <option key={item.id} value={item.id}>
                {elementName(project, item)} · {actors.indexOf(item) + 1}
              </option>)}
            </select>
          </label>}
          <fieldset className="interaction-fields">
            <legend>Action timing (seconds)</legend>
            <MediaNumber label="Start" value={draft.start} max={scene.duration} onChange={start => patch({ start, ...(draft.kind === "point" ? { attach: start } : {}) })} />
            {draft.kind !== "point" && <MediaNumber label="Attach" value={draft.attach} max={scene.duration} onChange={attach => patch({ attach })} />}
            {transfer && <MediaNumber label="Transfer" value={transfer.time} max={scene.duration} onChange={time => patch({ transfer: { ...transfer, time } })} />}
            {release && <MediaNumber label="Release" value={release.time} max={scene.duration} onChange={time => patch({ release: { ...release, time } })} />}
            <MediaNumber label="Finish" value={draft.finish} max={scene.duration} onChange={finish =>
              patch({ finish, ...(draft.kind === "point" ? { attach: draft.start } : {}) })} />
          </fieldset>
          {draft.kind !== "point" && !needsRelease(draft.kind) && <label className="world-check">
            <input type="checkbox" checked={!!release} onChange={event => patch({ release: event.target.checked
              ? { time: draft.finish, position: { x: prop?.x ?? 400, y: prop?.y ?? 340 } } : undefined })} /> Set the object down at a chosen spot
          </label>}
          {release && <fieldset className="interaction-fields">
            <legend>Release position</legend>
            <MediaNumber label="Release X" value={release.position.x} max={800} onChange={x => patch({ release: { ...release, position: { ...release.position, x } } })} />
            <MediaNumber label="Release Y" value={release.position.y} max={450} onChange={y => patch({ release: { ...release, position: { ...release.position, y } } })} />
          </fieldset>}
          <details>
            <summary>Hand and hold point</summary>
            {gripFields(draft.grip, transfer ? "Giving hand" : "Choose hand", actor, grip => patch({ grip }))}
            {transfer && gripFields(transfer.grip, "Receiving hand", receiver, grip => patch({ transfer: { ...transfer, grip } }))}
          </details>
          {compatibleWalk && <label className="world-check"><input type="checkbox" checked={walk}
            onChange={event => { setWalk(event.target.checked); setReview(false); }} /> Add an editable walk during this action</label>}
          {!compatibleWalk && actor && draft.kind !== "point" && <p className="field-hint">This character’s existing movement stays in place.</p>}
        </div>
        <div className="interaction-review">
          <div className="series-actions">
            <button className="button secondary" disabled={!!issue} onClick={() => { setReview(true); setCompare(false); }}>Preview</button>
            {review && <button className="button text" onClick={() => setCompare(value => !value)}>
              {compare ? "Show proposed scene" : "Compare current scene"}
            </button>}
          </div>
          {!issue && review ? <>
            <p role="status">{compare ? "Current scene" : "Proposed movement. Ready to apply."}</p>
            {!compare && <label className="world-check"><input type="checkbox" checked={markers}
              onChange={event => setMarkers(event.target.checked)} /> Show hold and release markers</label>}
            <ScenePreview project={project} scene={displayed} initialTime={current ? time : draft.attach}
              releaseMarker={!compare && markers ? release?.position : undefined}
              markers={!compare && markers ? [
                { actorId: draft.actorId, grip: draft.grip },
                ...(transfer ? [{ actorId: transfer.actorId, grip: transfer.grip }] : []),
              ] : undefined} />
          </> : <div className="interaction-empty"><p>{issue ?? "Preview the action to check the timing, hands and release position."}</p></div>}
          <p className="field-hint">A story object keeps its size and appearance. Its interaction controls position from Start through the rest of the scene, or until the next action for that object.</p>
        </div>
      </div>
      {error && <p role="alert">{error}</p>}
      {remove && <div role="group" aria-label="Confirm remove interaction" className="interaction-confirm">
        <p>Remove this interaction? Other animation and the story prop stay in the scene.</p>
        <button className="button secondary" onClick={() => setRemove(false)}>Keep interaction</button>
        <button className="button danger" onClick={() => {
          if (onApply({ interactions: (scene.interactions ?? []).filter(action => action.id !== current?.id) }) !== false) onClose();
        }}>Remove interaction</button>
      </div>}
      <div className="modal-actions">
        {current && !remove && <button className="button text" onClick={() => setRemove(true)}>Delete interaction</button>}
        <button className="button secondary" onClick={onClose}>Cancel</button>
        <button className="button primary" disabled={!!issue || !review} onClick={apply}>Apply</button>
      </div>
    </Modal>
  );
}
