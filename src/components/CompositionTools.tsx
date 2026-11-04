import type { Project, Scene, SceneElement } from "../model";
import { duplicateElement } from "../timeline";
import { elementName } from "../library";
import { DEPTH_LABELS, sceneryDepthAt, setSceneryDepth } from "../world-model";
import { SCENERY_DEPTHS } from "../art-model";
import type { SceneryDepth } from "../art-model";
import { Icon } from "./Icon";
import { ImageControls } from "./ImageControls";

export function CompositionTools({
  project,
  scene,
  selected,
  frame,
  onSelect,
  onChange,
  onElementChange,
  onLibrary,
  onSave,
  worldOpen = false,
}: {
  project: Project;
  scene: Scene;
  selected?: SceneElement;
  frame?: Partial<SceneElement>;
  onSelect: (id: string) => void;
  onChange: (patch: Partial<Scene>) => void;
  onElementChange?: (patch: Partial<SceneElement>) => void;
  onLibrary: () => void;
  onSave: () => void;
  worldOpen?: boolean;
}) {
  const shown = selected ? { ...selected, ...frame } : undefined;
  const index = scene.elements.findIndex((e) => e.id === selected?.id);
  function patch(value: Partial<SceneElement>) {
    if (onElementChange) {
      onElementChange(value);
      return;
    }
    if (selected)
      onChange({
        elements: scene.elements.map((e) =>
          e.id === selected.id ? { ...e, ...value } : e,
        ),
      });
  }
  function layer(direction: number) {
    const next = index + direction;
    if (index < 0 || next < 0 || next >= scene.elements.length) return;
    const elements = [...scene.elements];
    [elements[index], elements[next]] = [elements[next], elements[index]];
    for (const position of [index, next]) {
      const element = elements[position];
      if (element.sceneryDepth && !element.backdrop)
        elements[position] = { ...element, sceneryDepth: sceneryDepthAt(elements, position) };
    }
    onChange({ elements });
  }
  const asset =
    selected &&
    project.assets.find(
      (a) =>
        a.id ===
        (selected.assetId ??
          project.characters.find((c) => c.id === selected.characterId)
            ?.assetId),
    );
  return (
    <section className="composition-tools">
      <div className="composition-heading">
        <h3>Arrange your artwork</h3>
        <button className="button primary small" onClick={onLibrary}>
          <Icon name="plus" size={15} />
          Art library
        </button>
      </div>
      <p className="field-hint">
        Click or touch an object on the stage to select it. Drag to move, or use
        these controls.
      </p>
      {selected?.animation?.keyframes.length ? (
        <p className="field-hint">
          This object is animated. Movement and appearance edits add a keyframe
          at the playhead. Use the timeline to edit exact values, or Reset
          animation to return to the older movement presets.
        </p>
      ) : null}
      <label>
        Selected scene object
        <select
          aria-label="Selected scene object"
          value={selected?.id ?? ""}
          onChange={(e) => onSelect(e.target.value)}
        >
          <option value="" disabled>
            Choose an object
          </option>
          {scene.elements.map((e) => (
            <option key={e.id} value={e.id}>
              {elementName(project, e)}
            </option>
          ))}
        </select>
      </label>
      {selected && (
        <>
          {worldOpen && !selected.characterId && !selected.backdrop && <label>
            Scenery placement
            <select value={selected.sceneryDepth ?? ""} onChange={event => {
              const depth = event.target.value as SceneryDepth | "";
              onChange({ elements: setSceneryDepth(scene.elements, selected.id, depth || undefined) });
            }}>
              <option value="">Story prop (keep separate)</option>
              {SCENERY_DEPTHS.map(depth => <option key={depth} value={depth}>{DEPTH_LABELS[depth]}</option>)}
            </select>
          </label>}
          <div className="layer-actions">
            <button
              className="button secondary small"
              aria-label="Send backward"
              disabled={index <= 0}
              onClick={() => layer(-1)}
            >
              <Icon name="down" size={16} />
              Move backward
            </button>
            <button
              className="button secondary small"
              aria-label="Bring forward"
              disabled={index === scene.elements.length - 1}
              onClick={() => layer(1)}
            >
              <Icon name="up" size={16} />
              Move forward
            </button>
            <button
              className="icon-button"
              aria-label="Duplicate scene object"
              disabled={scene.elements.length >= 20}
              onClick={() => {
                const e = duplicateElement(selected, 15);
                onChange({ elements: [...scene.elements, e] });
                onSelect(e.id);
              }}
            >
              <Icon name="copy" size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Remove scene object"
              onClick={() =>
                onChange({
                  elements: scene.elements.filter((e) => e.id !== selected.id),
                })
              }
            >
              <Icon name="trash" size={17} />
            </button>
          </div>
          <div className="form-grid compact">
            <label>
              Object X
              <input
                aria-label="Object X"
                type="number"
                min="0"
                max="800"
                value={Math.round(shown!.x)}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (n >= 0 && n <= 800) patch({ x: n });
                }}
              />
            </label>
            <label>
              Object Y
              <input
                aria-label="Object Y"
                type="number"
                min="50"
                max="450"
                value={Math.round(shown!.y)}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (n >= 50 && n <= 450) patch({ y: n });
                }}
              />
            </label>
          </div>
          <label>
            Object size
            <input
              aria-label="Object size"
              type="range"
              min="0.3"
              max="2"
              step="0.05"
              value={shown!.scale}
              onChange={(e) => patch({ scale: Number(e.target.value) })}
            />
          </label>
          <label>
            Object movement
            <select
              aria-label="Object movement"
              value={selected.motion}
              disabled={!!selected.animation?.keyframes.length}
              onChange={(e) =>
                patch({ motion: e.target.value as SceneElement["motion"] })
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
          <ImageControls
            value={shown!}
            croppable={!!asset}
            defaultSize={
              selected.backdrop ? { width: 800, height: 450 } : undefined
            }
            onChange={patch}
          />
          <button
            className="button text small"
            onClick={() =>
              patch({ x: 400, y: selected.backdrop ? 450 : 340, scale: 1 })
            }
          >
            Reset placement
          </button>
          <button
            className="button secondary small save-source"
            onClick={onSave}
          >
            <Icon name="folder" size={16} />
            Save selected to library
          </button>
        </>
      )}
    </section>
  );
}
