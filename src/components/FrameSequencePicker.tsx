import { useState } from "react";
import { FRAME_SEQUENCE_RATES, MAX_FRAME_SEQUENCE_FILES, MAX_FRAME_SEQUENCE_BYTES } from "../frame-sequence-model";
import { numberedPngFrames } from "../studio-frame-sequence";
import { groupNumberedShots } from "../studio-multishot";
import type { NumberedShot } from "../studio-multishot";

/** Manual-only, local and explicit: no connection to Framefield accounts. */
export function FrameSequencePicker({
  onCreate,
}: {
  onCreate: (files: File[], fps: number, multiShot: boolean) => Promise<void>;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [fps, setFps] = useState<number>(8);
  const [multiShot, setMultiShot] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  let ordered: File[] = [];
  let shots: NumberedShot[] = [];
  let validationError = "";
  if (files.length) {
    try {
      if (multiShot) shots = groupNumberedShots(files);
      else ordered = numberedPngFrames(files);
    } catch (cause) {
      validationError = cause instanceof Error ? cause.message : "Invalid numbered PNG selection.";
    }
  }
  const displayedError = error || validationError;
  const canCreate = multiShot ? shots.length >= 2 : ordered.length >= 2;

  async function create() {
    setError("");
    try {
      // Validate a second time at the actual user action, so a stale
      // selection or a changed import mode cannot bypass the preview checks.
      const frames = multiShot
        ? groupNumberedShots(files).flatMap(shot => shot.files)
        : numberedPngFrames(files);
      setBusy(true);
      await onCreate(frames, fps, multiShot);
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
        Select the multi-shot option below to combine up to 3 separate shots (40 PNG frames total).
      </p>
      <label className="studio-shot-mode">
        <input type="checkbox" checked={multiShot} disabled={busy}
          onChange={event => {
            setMultiShot(event.target.checked);
            setError("");
          }} />
        Build a multi-shot cartoon (2–3 numbered sequences)
      </label>
      <p className="field-hint">
        Multiple shots use distinct names such as shot01_frame_0001.png and
        shot02_frame_0001.png. Shots play in numeric filename order with
        hard scene cuts; this does not alter existing cartoons.
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
        {multiShot && shots.length
          ? `${shots.length} shots in order: ${shots.map(shot =>
              `${shot.prefix} (${shot.files.length} frames)`).join(" → ")}. Total ${shots.reduce(
                (seconds, shot) => seconds + Math.max(2, Math.ceil(shot.files.length / fps)), 0)} seconds.`
          : !multiShot && ordered.length
            ? `${ordered.length} frames in order: ${ordered[0].name} → ${ordered[ordered.length - 1].name}. Approx. ${(ordered.length / fps).toFixed(2)}s of movement.`
            : files.length ? `${files.length} files selected; check the message below.`
              : "Select your local frames; nothing is uploaded to another service."}
      </p>
      {displayedError && <p role="alert" className="error-message">{displayedError}</p>}
      <button type="button" className="button secondary small"
        disabled={!canCreate || busy || !!displayedError}
        onClick={() => void create()}>
        {busy ? "Checking and importing frames…" : multiShot
          ? "Create multi-shot cartoon" : "Create cartoon from numbered PNGs"}
      </button>
      <p className="field-hint">
        Original PNGs become individual portable artwork assets. They are fixed rendered
        images, not editable 3D meshes, characters, or Framefield rig/keyframe files.
        Multi-shot projects contain up to three independent timed scenes, each with its original
        PNG files. Large sequences are best split into shorter scenes.
      </p>
    </section>
  );
}
