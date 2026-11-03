import { useState } from "react";
import type { Project, SceneElement } from "../model";
import { POSES } from "../art-model";
import { EMOTIONS } from "../animation-model";
import { resolvedCharacter } from "../library";
import { applyCharacterAppearance } from "../story";
import { actionsFor } from "../presets";
import { CartoonCharacter } from "./Stage";
import { Modal } from "./Modal";

export function CharacterReference({
  project,
  source,
  sceneId,
  onChange,
  onLibrary,
  onClose,
}: {
  project: Project;
  source: SceneElement;
  sceneId: string;
  onChange: (p: Project) => void;
  onLibrary: () => void;
  onClose: () => void;
}) {
  const character = resolvedCharacter(project, source)!;
  const asset = project.assets.find(
    (a) => a.id === (source.assetId ?? character.assetId),
  );
  const [scope, setScope] = useState("scene"),
    [confirm, setConfirm] = useState(false),
    [message, setMessage] = useState("");
  const targets = project.scenes.filter(
    (s) =>
      (scope === "episode" || s.id === sceneId) &&
      s.elements.some((e) => e.characterId === source.characterId),
  );
  return (
    <Modal
      title={`${character.name} · character reference`}
      onClose={onClose}
      wide
    >
      <p className="section-description">
        This is the selected scene’s appearance. Scene edits and this
        consistency tool never modify your saved library character or original
        artwork.
      </p>
      <div className="character-reference-grid">
        <div className="reference-portrait">
          {asset ? (
            <img
              src={asset.dataUrl}
              alt={`${character.name} original artwork`}
            />
          ) : (
            <svg
              viewBox="-100 -250 200 260"
              role="img"
              aria-label={`${character.name} appearance`}
            >
              <CartoonCharacter
                character={character}
                emotion={source.emotion}
                pose={source.pose}
              />
            </svg>
          )}
          <strong>{character.name}</strong>
          <span>
            {asset ? "Original artwork preserved" : "Original shape character"}
          </span>
        </div>
        <div>
          <h3>Appearance</h3>
          <ul className="appearance-colors">
            {(["shirt", "skin", "hair"] as const).map((key) => (
              <li key={key}>
                <i style={{ background: character[key] }} />
                {key}: {character[key]}
              </li>
            ))}
          </ul>
          <p>Accessory: {character.accessory}</p>
          <h3>Available artwork</h3>
          <p>
            {asset
              ? `${asset.mime} · ${asset.sourceWidth ?? "original"} × ${asset.sourceHeight ?? "size"}`
              : "Editable original shape artwork"}
          </p>
          {asset ? (
            <p className="field-hint">
              This single image supports whole-image motion. Separate
              expressions and poses require separately created artwork.
            </p>
          ) : (
            <>
              <h3>Expressions</h3>
              <p>{EMOTIONS.join(" · ")}</p>
              <h3>Poses</h3>
              <p>{POSES.join(" · ")}</p>
            </>
          )}
          <h3>Reusable motions</h3>
          <p>
            {actionsFor(!asset)
              .filter(([id]) => id !== "door")
              .map(([, label]) => label)
              .join(" · ")}
          </p>
        </div>
      </div>
      <section className="appearance-apply">
        <h3>Keep this appearance consistent</h3>
        <p className="field-hint">
          Copy only the name, colors, accessory and source artwork to matching
          characters. Positions, layers, expressions, poses and animation stay
          as authored.
        </p>
        <label>
          Apply appearance to
          <select
            value={scope}
            onChange={(e) => {
              setScope(e.target.value);
              setConfirm(false);
            }}
          >
            <option value="scene">Matching instances in this scene</option>
            <option value="episode">
              Matching instances throughout this episode
            </option>
          </select>
        </label>
        {confirm ? (
          <div className="media-notice">
            <p>
              Apply this appearance to matching characters in {targets.length}{" "}
              scene(s)? You can undo this edit.
            </p>
            <div className="animation-actions">
              <button
                className="button secondary"
                onClick={() => setConfirm(false)}
              >
                Cancel appearance change
              </button>
              <button
                className="button primary"
                onClick={() => {
                  onChange(
                    applyCharacterAppearance(
                      project,
                      source,
                      new Set(targets.map((s) => s.id)),
                    ),
                  );
                  setConfirm(false);
                  setMessage(
                    `Appearance applied in ${targets.length} scene(s). Your library is unchanged.`,
                  );
                }}
              >
                Confirm appearance change
              </button>
            </div>
          </div>
        ) : (
          <button className="button secondary" onClick={() => setConfirm(true)}>
            Apply this appearance…
          </button>
        )}
        {message && <p role="status">{message}</p>}
      </section>
      <div className="modal-actions">
        <button className="button secondary" onClick={onLibrary}>
          Open library characters
        </button>
        <button className="button primary" onClick={onClose}>
          Back to scene
        </button>
      </div>
    </Modal>
  );
}
