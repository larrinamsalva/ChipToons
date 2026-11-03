import { useRef, useState } from "react";
import type { Asset } from "../model";
import { readImage } from "../files";
import type { ArtworkRole } from "../story";
import { Modal } from "./Modal";
import { Icon } from "./Icon";

export function ArtworkStart({
  source,
  initial,
  onClose,
  onDraw,
  onNext,
}: {
  source: "sketch" | "image";
  initial?: { asset: Asset; name: string };
  onClose: () => void;
  onDraw: () => void;
  onNext: (asset: Asset, name: string, role: ArtworkRole) => void;
}) {
  const [art, setArt] = useState(initial);
  const [name, setName] = useState(initial?.name ?? "My character");
  const [role, setRole] = useState<ArtworkRole>("character");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const asset = await readImage(file);
      const title =
        file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "My artwork";
      setArt({ asset, name: title });
      setName(title);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "This image could not be opened.",
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <Modal
      title={
        source === "sketch" ? "Start with a Sketch" : "Start with an Image"
      }
      onClose={onClose}
    >
      <p className="section-description">
        Bring your original artwork, then tell the studio how you want to use
        it.
      </p>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label="Guided artwork file"
        className="visually-hidden"
        tabIndex={-1}
        onChange={(e) => void upload(e.target.files?.[0])}
      />
      {art && (
        <img
          className="artwork-start-preview"
          src={art.asset.dataUrl}
          alt="Your original artwork"
        />
      )}
      <div className="animation-actions">
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <Icon name="upload" />
          {busy
            ? "Opening artwork…"
            : art
              ? "Choose different artwork"
              : "Upload original artwork"}
        </button>
        {source === "sketch" && (
          <button className="button secondary" onClick={onDraw}>
            <Icon name="pencil" />
            Draw my artwork
          </button>
        )}
      </div>
      <p className="field-hint">
        PNG, JPEG or WebP · up to 4 MB · under 24 megapixels. The source stays
        intact on this device.
      </p>
      {art && (
        <div className="property-fields">
          <label>
            Artwork name
            <input
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Use this artwork as
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as ArtworkRole)}
            >
              <option value="character">Main character</option>
              <option value="prop">Movable object</option>
              <option value="background">Scene background</option>
            </select>
          </label>
        </div>
      )}
      <p className="local-note">
        <Icon name="bulb" size={18} />
        <span>
          You identify the subject manually. The whole picture can move, turn,
          fade and zoom. Crop it later in Image tools; faces and limbs are not
          automatically separated.
        </span>
      </p>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button className="button secondary" onClick={onClose}>
          Back
        </button>
        <button
          className="button primary"
          disabled={!art || !name.trim() || busy}
          onClick={() => art && onNext(art.asset, name, role)}
        >
          Next: plan my story
          <Icon name="arrow" />
        </button>
      </div>
    </Modal>
  );
}
