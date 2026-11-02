import { useEffect, useMemo, useRef, useState } from "react";
import { clone, uid } from "../model";
import type { Asset, Emotion } from "../model";
import type { Pose } from "../art-model";
import { POSES } from "../art-model";
import {
  imageLibraryItem,
  listLibrary,
  newLibraryItem,
  removeLibraryItem,
  saveLibraryItem,
  starterLibrary,
} from "../library";
import type { LibraryItem, LibraryKind } from "../library";
import { starterProject } from "../planner";
import { readImage, downloadBlob, safeFilename } from "../files";
import { Stage } from "./Stage";
import { Modal } from "./Modal";
import { Icon } from "./Icon";
import { DrawingPad } from "./DrawingPad";
import { ImageControls } from "./ImageControls";

export function ArtThumbnail({ item }: { item: LibraryItem }) {
  const base = useMemo(() => starterProject(), []);
  const p = {
    ...base,
    assets: item.assets,
    characters: item.character ? [item.character] : base.characters,
  };
  const scene = {
    ...base.scenes[0],
    title: item.name,
    action: `${item.kind} artwork`,
    background: item.background ?? "meadow",
    elements: [] as (typeof base.scenes)[0]["elements"],
  };
  if (item.character || item.assetId || item.prop)
    scene.elements = [
      {
        ...base.scenes[0].elements[0],
        id: "preview-object",
        kind: item.character
          ? "character"
          : item.prop && !item.assetId
            ? "prop"
            : "art",
        characterId: item.character?.id ?? "",
        prop: item.prop,
        backdrop: item.kind === "background",
        assetId: item.assetId,
        x: 400,
        y: item.kind === "background" ? 450 : 350,
        scale: 1,
        emotion: item.emotion,
        pose: item.pose,
        motion: "still",
        ...(item.kind === "background" ? { width: 800, height: 450 } : {}),
        ...item.transform,
      },
    ];
  return <Stage project={p} scene={scene} />;
}
export function ArtLibrary({
  onClose,
  onUse,
  draft: initial,
  inProject = false,
}: {
  onClose: () => void;
  onUse: (item: LibraryItem, three?: boolean) => void;
  draft?: LibraryItem;
  inProject?: boolean;
}) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const starters = useMemo(() => starterLibrary(), []);
  const [kind, setKind] = useState<LibraryKind>("character");
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("all");
  const [source, setSource] = useState("all");
  const [draft, setDraft] = useState<LibraryItem | null>(initial ?? null);
  const [isNew, setIsNew] = useState(true);
  const [drawing, setDrawing] = useState<LibraryItem | boolean>(false);
  const [deleting, setDeleting] = useState<LibraryItem | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let alive = true;
    listLibrary()
      .then((items) => {
        if (alive) setItems(items);
      })
      .catch(() => {
        if (alive)
          setError(
            "Your personal library could not be opened. Original starters still work. Retry opening the library before saving new artwork.",
          );
      });
    return () => {
      alive = false;
    };
  }, []);
  const collection = [...items, ...(source === "mine" ? [] : starters)];
  const visible = collection.filter(
    (i) =>
      i.kind === kind &&
      (group === "all" || i.group === group) &&
      `${i.name} ${i.tags.join(" ")} ${i.group}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  function edit(item: LibraryItem, copy = false) {
    const d = clone(item);
    const fresh = copy || item.id.startsWith("starter-");
    if (fresh) {
      d.id = uid();
      d.group = "My collection";
      if (copy) d.name = `${d.name.slice(0, 70)} copy`;
    }
    setIsNew(fresh);
    setDraft(d);
    setError("");
  }
  async function save() {
    if (!draft || busy) return;
    setBusy(true);
    setError("");
    const next = { ...draft, updatedAt: new Date().toISOString() };
    try {
      await saveLibraryItem(next, isNew);
      setItems((list) => [next, ...list.filter((i) => i.id !== next.id)]);
      setKind(next.kind);
      setDraft(null);
      setNotice(`Saved ${next.name} to your reusable library.`);
    } catch {
      setError(
        "Your artwork could not be saved to this browser. It is still open here. Try saving again, or download the original image before closing.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const asset = await readImage(file);
      setDraft(
        imageLibraryItem(
          asset,
          file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "My artwork",
          kind === "drawing" ? "prop" : kind,
        ),
      );
      setIsNew(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "This image could not be opened.",
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  function use(item: LibraryItem, three = false) {
    try {
      onUse(item, three);
      setNotice(
        three
          ? `Added ${item.name} to up to three scenes. Each copy can be edited independently.`
          : `Added ${item.name}. Close the library to arrange it on your stage.`,
      );
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "This artwork could not be added.",
      );
    }
  }
  function drawn(asset: Asset, name: string) {
    const existing = typeof drawing === "object" ? drawing : null;
    const next = existing
      ? {
          ...clone(existing),
          name,
          assets: [asset],
          assetId: asset.id,
          character: existing.character
            ? { ...existing.character, name, assetId: asset.id }
            : undefined,
        }
      : imageLibraryItem(asset, name, kind);
    setDraft(next);
    setIsNew(!existing || existing.id.startsWith("starter-"));
    setDrawing(false);
    setError("");
  }
  if (drawing) {
    const d = typeof drawing === "object" ? drawing : undefined;
    return (
      <DrawingPad
        onClose={() => setDrawing(false)}
        onSave={drawn}
        initial={d?.assets.find((a) => a.id === d.assetId)?.drawing}
        name={d?.name}
        saveLabel="Continue to save artwork"
      />
    );
  }
  if (deleting)
    return (
      <Modal
        title="Remove this saved artwork?"
        onClose={() => setDeleting(null)}
      >
        <p>
          <strong>{deleting.name}</strong> will be removed from your personal
          library. Every cartoon keeps its own artwork, so existing projects and
          backups stay intact.
        </p>
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button
            className="button secondary"
            onClick={() => setDeleting(null)}
          >
            Keep artwork
          </button>
          <button
            className="button danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await removeLibraryItem(deleting.id);
                setItems((i) => i.filter((v) => v.id !== deleting.id));
                setDeleting(null);
                setNotice(
                  "Library source removed. Existing cartoons retain their copies.",
                );
              } catch {
                setError(
                  "This artwork could not be deleted. Please try again.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Delete library entry
          </button>
        </div>
      </Modal>
    );
  if (draft)
    return (
      <Modal
        title={
          isNew ? "Save a little creative magic." : "Edit your saved artwork."
        }
        onClose={() => setDraft(null)}
        wide
      >
        <div className="asset-editor-grid">
          <div className="asset-large-preview">
            <ArtThumbnail item={draft} />
            <span className="asset-type">{draft.kind}</span>
            {draft.assets[0] && (
              <>
                <p className="field-hint">
                  Your source image is preserved. Cropping and transforms are
                  editable settings.
                </p>
                <button
                  className="button text small"
                  onClick={() =>
                    void fetch(draft.assets[0].dataUrl)
                      .then((r) => r.blob())
                      .then((blob) =>
                        downloadBlob(
                          blob,
                          `${safeFilename(draft.name)}.${draft.assets[0].mime === "image/jpeg" ? "jpg" : draft.assets[0].mime === "image/webp" ? "webp" : "png"}`,
                        ),
                      )
                  }
                >
                  Download original image
                </button>
              </>
            )}
            {draft.assets[0]?.drawing && (
              <button
                className="button secondary small"
                onClick={() => setDrawing(draft)}
              >
                Edit drawing objects
              </button>
            )}
          </div>
          <div className="asset-editor-fields">
            <label>
              Artwork name
              <input
                aria-label="Artwork name"
                maxLength={80}
                required
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <div className="form-grid compact">
              <label>
                Collection
                <input
                  maxLength={80}
                  value={draft.group}
                  onChange={(e) =>
                    setDraft({ ...draft, group: e.target.value })
                  }
                />
              </label>
              <label>
                Tags <span className="label-note">separate with commas</span>
                <input
                  key={draft.id}
                  defaultValue={draft.tags.join(", ")}
                  onBlur={(e) =>
                    setDraft({
                      ...draft,
                      tags: e.target.value
                        .split(",")
                        .map((s) => s.trim().slice(0, 40))
                        .filter(Boolean)
                        .slice(0, 15),
                    })
                  }
                />
              </label>
            </div>
            {draft.character && !draft.character.assetId && (
              <>
                <div className="character-colors">
                  {(["shirt", "skin", "hair"] as const).map((k) => (
                    <label key={k}>
                      {k === "shirt"
                        ? "Outfit"
                        : k === "skin"
                          ? "Skin"
                          : "Hair"}
                      <input
                        aria-label={`Library ${k}`}
                        type="color"
                        value={draft.character![k]}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            character: {
                              ...draft.character!,
                              [k]: e.target.value,
                            },
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
                <label>
                  Accessory
                  <select
                    value={draft.character.accessory}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        character: {
                          ...draft.character!,
                          accessory: e.target.value as "cap" | "bow" | "none",
                        },
                      })
                    }
                  >
                    <option value="none">None</option>
                    <option value="cap">Little cap</option>
                    <option value="bow">Little bow</option>
                  </select>
                </label>
                <div className="form-grid compact">
                  <label>
                    Expression
                    <select
                      value={draft.emotion}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          emotion: e.target.value as Emotion,
                        })
                      }
                    >
                      {[
                        "happy",
                        "sad",
                        "calm",
                        "surprised",
                        "excited",
                        "worried",
                      ].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Pose
                    <select
                      value={draft.pose}
                      onChange={(e) =>
                        setDraft({ ...draft, pose: e.target.value as Pose })
                      }
                    >
                      {POSES.map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </>
            )}
            {draft.assets.length > 0 && (
              <ImageControls
                value={draft.transform}
                defaultSize={
                  draft.kind === "background"
                    ? { width: 800, height: 450 }
                    : undefined
                }
                croppable
                onChange={(patch) =>
                  setDraft({
                    ...draft,
                    transform: { ...draft.transform, ...patch },
                  })
                }
              />
            )}
          </div>
        </div>
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button className="button secondary" onClick={() => setDraft(null)}>
            Cancel
          </button>
          <button
            className="button primary"
            disabled={busy || !draft.name.trim()}
            onClick={() => void save()}
          >
            <Icon name="check" />
            {busy ? "Saving artwork…" : "Save to library"}
          </button>
        </div>
      </Modal>
    );
  return (
    <Modal
      title="Your little library of big possibilities."
      onClose={onClose}
      wide
    >
      <p className="section-description">
        Save a character once. Give it a hundred adventures. Your cartoons keep
        independent copies.
      </p>
      <div className="library-tabs" aria-label="Artwork categories">
        {(["character", "background", "prop", "drawing"] as LibraryKind[]).map(
          (k) => (
            <button
              key={k}
              className={kind === k ? "active" : ""}
              aria-pressed={kind === k}
              onClick={() => {
                setKind(k);
                setGroup("all");
              }}
            >
              {k === "drawing"
                ? "Drawings"
                : k[0].toUpperCase() + k.slice(1) + "s"}
            </button>
          ),
        )}
      </div>
      <div className="library-actions">
        <button
          className="button primary small"
          onClick={() => {
            if (kind === "character") {
              setDraft(newLibraryItem());
              setIsNew(true);
              setError("");
            } else setDrawing(true);
          }}
        >
          <Icon name="plus" />
          {kind === "character" ? "New character" : "Create drawing"}
        </button>
        <button
          className="button secondary small"
          onClick={() => setDrawing(true)}
        >
          <Icon name="pencil" />
          Draw artwork
        </button>
        <button
          className="button secondary small"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <Icon name="upload" />
          Upload artwork
        </button>
        <button
          className="button text small"
          onClick={() => setHelp((v) => !v)}
        >
          <Icon name="help" />
          Show me how
        </button>
      </div>
      {help && (
        <ol className="library-guide">
          <li>
            Create or draw a character, then choose{" "}
            <strong>Save to library</strong>.
          </li>
          <li>
            Open a cartoon, select a scene, and open{" "}
            <strong>Art library</strong>.
          </li>
          <li>
            Find your character and choose <strong>Add to three scenes</strong>,
            or add it to each scene separately.
          </li>
          <li>
            Close the library, click a character on the stage, and drag or use
            its position controls. Each scene keeps its own changes.
          </li>
        </ol>
      )}
      <div className="library-search">
        <label>
          Find artwork
          <input
            type="search"
            placeholder="Name, tag, or collection…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          Show
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="all">My artwork + starters</option>
            <option value="mine">My saved artwork</option>
          </select>
        </label>
        <label>
          Collection
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="all">All collections</option>
            {[...new Set(collection.map((i) => i.group))].map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="library-notice">
          <Icon name="check" />
          {notice}
        </p>
      )}
      <div className="library-grid">
        {visible.map((item) => (
          <article className="library-card" key={item.id}>
            <div className="library-art">
              <ArtThumbnail item={item} />
            </div>
            <div className="library-card-info">
              <small>{item.group}</small>
              <h3>{item.name}</h3>
              {item.tags.length > 0 && (
                <p className="field-hint">{item.tags.join(" · ")}</p>
              )}
              <button
                className="button primary small"
                onClick={() => use(item)}
              >
                {inProject ? "Add to scene" : "Start cartoon with this"}
                <Icon name="plus" size={16} />
              </button>
              {inProject && item.kind !== "background" && (
                <button
                  className="button text small"
                  onClick={() => use(item, true)}
                >
                  Add to three scenes
                </button>
              )}
              <div className="library-card-options">
                <button
                  className="button text small"
                  onClick={() => edit(item)}
                >
                  {item.id.startsWith("starter-")
                    ? "Customize a copy"
                    : "Edit / rename"}
                </button>
                <button
                  className="icon-button"
                  aria-label={`Duplicate ${item.name}`}
                  onClick={() => edit(item, true)}
                >
                  <Icon name="copy" size={16} />
                </button>
                {!item.id.startsWith("starter-") && (
                  <button
                    className="icon-button"
                    aria-label={`Delete library ${item.name}`}
                    onClick={() => {
                      setError("");
                      setDeleting(item);
                    }}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      {!visible.length && (
        <div className="library-empty">
          <Icon name="pencil" size={34} />
          <h3>A little space for something only you can make.</h3>
          <p>Create, draw or upload artwork to start this collection.</p>
        </div>
      )}
      <input
        type="file"
        className="visually-hidden"
        ref={input}
        accept="image/png,image/jpeg,image/webp"
        tabIndex={-1}
        aria-label="Library image file"
        onChange={(e) => void upload(e.target.files?.[0])}
      />
      <div className="modal-actions">
        <button className="button secondary" onClick={onClose}>
          Back to my {inProject ? "story" : "studio"}
          <Icon name="arrow" />
        </button>
      </div>
    </Modal>
  );
}
