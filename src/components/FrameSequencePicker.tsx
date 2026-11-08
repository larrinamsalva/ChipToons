import { useState } from "react";
import { FRAME_SEQUENCE_RATES, MAX_FRAME_SEQUENCE_FILES, MAX_FRAME_SEQUENCE_BYTES } from "../frame-sequence-model";
import { numberedPngFrames } from "../studio-frame-sequence";

/** Manual-only, local and explicit: no connection to Framefield accounts. */
export function FrameSequencePicker({
  onCreate,
}: {
  onCreate: (files: File[], fps: number) => Promise<void>;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [fps, setFps] = useState<number>(8);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  let ordered: File[] = [];
  if (files.length) {
    try { ordered = numberedPngFrames(files); }
    catch (cause) { error = error || (cause instanceof Error ? cause.message : "Invalid PNG sequence."); }
  }

  async function create() {
    setError("");
    try {
      const frames = numberedPngFrames(files);
      setBusy(true);
      await onCreate(frames, fps);
      setFiles([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The original PNG frames could not be opened.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="studio-frame-picker" aria-label="Import numbered PNG animation">
      <h3>Framefield PNG animation · local import</h3>
      <p className="field-hint">
        Import a complete run of {2}–{MAX_FRAME_SEQUENCE_FILES} numbered PNGs, such as
        frame_0001.png, frame_0002.png, and frame_0003.png. All frames must have the
        same dimensions, up to 1280 × 720, and total no more than {MAX_FRAME_SEQUENCE_BYTES / (1024 * 1024)} MB.
        This creates a <strong>new</strong> editable cartoon; your existing work is never replaced.
      </p>
      <div className="studio-frame-controls">
        <label>
          Choose numbered PNG files
          <input type="file" accept=".png,image/png" multiple
            aria-label="Choose numbered PNG files"
            disabled={busy}
            onChange={event => {
              setError("");
              setFiles(Array.from(event.target.files ?? []));
            }} />
        </label>
        <label>
          Animation playback speed
          <select aria-label="Animation playback speed" value={fps} disabled={busy}
            onChange={event => setFps(Number(event.target.value))}>
            {FRAME_SEQUENCE_RATES.map(rate =>
              <option key={rate} value={rate}>{rate} frames/second</option>)}
          </select>
        </label>
      </div>
      <p role="status" className="field-hint">
        {ordered.length
          ? `${ordered.length} frames in order: ${ordered[0].name} → ${ordered[ordered.length - 1].name}. Approx. ${(ordered.length / fps).toFixed(2)}s of movement.`
          : files.length ? `${files.length} files selected; check the message below.`
            : "Select your local frames; nothing is uploaded to another service."}
      </p>
      {error && <p role="alert" className="error-message">{error}</p>}
      <button type="button" className="button secondary small"
        disabled={!ordered.length || busy || !!error}
        onClick={() => void create()}>
        {busy ? "Checking and importing frames…" : "Create cartoon from numbered PNGs"}
      </button>
      <p className="field-hint">
        Original PNGs become individual portable artwork assets. They are fixed rendered
        images, not editable 3D meshes, characters, or Framefield rig/keyframe files.
        Large frame sequences are best split into short scenes.
      </p>
    </section>
  );
}
