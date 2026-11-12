import { useState } from "react";
import { ShotFramePreview } from "./ShotFramePreview";
import { ShotBeatEditor } from "./ShotBeatEditor";
import { SubtitleCueEditor } from "./SubtitleCueEditor";
import { emptyShotBeat } from "../studio-shot-beats";
import { formatVoiceCueSheet } from "../studio-voice-cues";
import { storyboardSubtitleSrt } from "../studio-subtitle-drafts";
import type { SubtitleDraftAdjustment } from "../studio-subtitle-drafts";
import type { ShotBeat } from "../studio-shot-beats";
import { StoryReelPlayer } from "./StoryReelPlayer";
import { planStoryReel } from "../studio-story-reel";
import { FRAME_SEQUENCE_RATES, MAX_FRAME_SEQUENCE_FILES, MAX_FRAME_SEQUENCE_BYTES } from "../frame-sequence-model";
import { numberedPngFrames } from "../studio-frame-sequence";
import { groupNumberedShots, MAX_STORYBOARD_SHOTS } from "../studio-multishot";
import type { NumberedShot, ShotDirection } from "../studio-multishot";

/** Manual-only, local and explicit: no connection to Framefield accounts. */
export function FrameSequencePicker({
  onCreate,
}: {
  onCreate: (files: File[], fps: number, multiShot: boolean,
    direction?: ShotDirection[], beats?: ShotBeat[],
    includeDraftCaptions?: boolean, subtitleEdits?: SubtitleDraftAdjustment[]) => Promise<void>;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [fps, setFps] = useState<number>(8);
  const [multiShot, setMultiShot] = useState(false);
  const [shotDirection, setShotDirection] = useState<ShotDirection[]>([]);
  const [storyBeats, setStoryBeats] = useState<Record<string, ShotBeat>>({});
  const [subtitleEdits, setSubtitleEdits] = useState<Record<string, SubtitleDraftAdjustment>>({});
  const [includeDraftCaptions, setIncludeDraftCaptions] = useState(false);
  const [selectionEpoch, setSelectionEpoch] = useState(0);
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
  // Preserve the current manual order across rerenders; when input files
  // change, the file picker resets the order instead of keeping stale refs.
  const arranged = multiShot && shots.length
    ? (shotDirection.length === shots.length && shotDirection.every(item =>
        shots.some(shot => shot.prefix === item.prefix))
        ? shotDirection
        : shots.map(shot => ({ prefix: shot.prefix, holdSeconds: 0 as const })))
    : [];
  const activeSubtitleEdits = arranged.flatMap(item =>
    subtitleEdits[item.prefix] ? [subtitleEdits[item.prefix]] : []);
  const hasSubtitleDraft = arranged.some(item => {
    const edit = subtitleEdits[item.prefix];
    return edit
      ? !!(edit.first.trim() || edit.second.trim())
      : !!storyBeats[item.prefix]?.narration.trim();
  });
  const totalSeconds = arranged.reduce((seconds, item) => {
    const shot = shots.find(candidate => candidate.prefix === item.prefix)!;
    return seconds + Math.max(2, Math.ceil(shot.files.length / fps)) + item.holdSeconds;
  }, 0);
  function moveShot(index: number, offset: -1 | 1) {
    const target = index + offset;
    if (busy || index < 0 || target < 0 || target >= arranged.length) return;
    const next = [...arranged];
    [next[index], next[target]] = [next[target], next[index]];
    setShotDirection(next);
  }
  function changeBeat(next: ShotBeat) {
    if (busy) return;
    setError("");
    setStoryBeats(current => ({ ...current, [next.prefix]: next }));
  }
  function downloadSubtitleDraft() {
    if (busy || !multiShot || !canCreate || displayedError) return;
    try {
      const plan = planStoryReel(shots, fps, arranged);
      const beats = arranged.map(item =>
        storyBeats[item.prefix] ?? emptyShotBeat(item.prefix));
      const srt = storyboardSubtitleSrt(plan, beats, activeSubtitleEdits);
      if (!srt) return;
      // Explicit local download only. Caption data never enters the
      // project or finished movie until reviewed in the real editor.
      const link = document.createElement("a");
      link.href = `data:application/x-subrip;charset=utf-8,${encodeURIComponent(srt)}`;
      link.download = "chiptoons-storyboard-subtitle-draft.srt";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message
        : "Could not prepare your local subtitle draft.");
    }
  }

  function downloadVoiceCues() {
    if (busy || !multiShot || !canCreate || displayedError) return;
    try {
      // Only the creator's existing short local notes leave as a user-
      // initiated .txt download. No remote submission or hidden export.
      const plan = planStoryReel(shots, fps, arranged);
      const beats = arranged.map(item =>
        storyBeats[item.prefix] ?? emptyShotBeat(item.prefix));
      const report = formatVoiceCueSheet(plan, beats);
      const link = document.createElement("a");
      // The bounded text is small enough for a local data URL; this avoids
      // object-URL lifetime issues and does not navigate or upload anything.
      link.href = `data:text/plain;charset=utf-8,${encodeURIComponent(report)}`;
      link.download = "chiptoons-storyboard-voice-cues.txt";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message
        : "Could not prepare your local recording script.");
    }
  }

  function changeSubtitleEdit(prefix: string, next?: SubtitleDraftAdjustment) {
    if (busy) return;
    setError("");
    setSubtitleEdits(current => {
      const updates = { ...current };
      if (next) updates[prefix] = next;
      else delete updates[prefix];
      return updates;
    });
  }

  function holdShot(prefix: string, holdSeconds: 0 | 1 | 2 | 3) {
    if (busy) return;
    setShotDirection(arranged.map(item => item.prefix === prefix
      ? { ...item, holdSeconds } : item));
  }

  async function create() {
    setError("");
    try {
      // Validate a second time at the actual user action, so a stale
      // selection or a changed import mode cannot bypass the preview checks.
      const frames = multiShot
        ? groupNumberedShots(files).flatMap(shot => shot.files)
        : numberedPngFrames(files);
      setBusy(true);
      const beats = multiShot
        ? arranged.map(item => storyBeats[item.prefix] ?? emptyShotBeat(item.prefix))
        : undefined;
      await onCreate(frames, fps, multiShot, multiShot ? [...arranged] : undefined,
        beats, multiShot && includeDraftCaptions, multiShot && includeDraftCaptions
          ? [...activeSubtitleEdits] : undefined);
      setFiles([]);
      setShotDirection([]);
      setStoryBeats({});
      setSubtitleEdits({});
      setIncludeDraftCaptions(false);
      setSelectionEpoch(value => value + 1);
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
        Select the multi-shot option below to combine up to {MAX_STORYBOARD_SHOTS} separate shots (40 PNG frames total).
      </p>
      <label className="studio-shot-mode">
        <input type="checkbox" checked={multiShot} disabled={busy}
          onChange={event => {
            setMultiShot(event.target.checked);
            setShotDirection([]);
            setStoryBeats({});
            setSubtitleEdits({});
            setIncludeDraftCaptions(false);
            setSelectionEpoch(value => value + 1);
            setError("");
          }} />
        Build a multi-shot cartoon (2–8 numbered sequences)
      </label>
      <p className="field-hint">
        Multiple shots use distinct names such as shot01_frame_0001.png and
        shot02_frame_0001.png. Shots start in numeric filename order; use
        Shot Director below to rearrange them or pause on a final frame.
        Only your new cartoon is affected.
      </p>
      <div className="studio-frame-controls">
        <label>
          Choose numbered PNG files
          <input type="file" accept=".png,image/png" multiple
            aria-label="Choose numbered PNG files"
            disabled={busy}
            onChange={event => {
              setError("");
              setShotDirection([]);
              setStoryBeats({});
              setSubtitleEdits({});
              setIncludeDraftCaptions(false);
              setSelectionEpoch(value => value + 1);
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
      {!multiShot && ordered.length >= 2 && (
        <ShotFramePreview key={`single-${selectionEpoch}`}
          files={ordered} prefix="single-shot" fps={fps} disabled={busy} />
      )}
      {multiShot && shots.length >= 2 && (
        <section className="studio-shot-director" aria-label="Shot Director">
          <h4>Shot Director · arrange your story</h4>
          <p className="field-hint">Inspect any original PNG with the frame slider,
            then move each shot earlier or later. Optionally hold its final original
            image for 1–3 extra seconds before the next shot. These visual previews
            use only local files; nothing changes the PNGs themselves.</p>
          <ol aria-label="Shot playback order">
            {arranged.map((item, index) => {
              const shot = shots.find(candidate => candidate.prefix === item.prefix)!;
              const seconds = Math.max(2, Math.ceil(shot.files.length / fps)) +
                item.holdSeconds;
              return (
                <li key={item.prefix}>
                  <div className="studio-shot-line">
                    <strong>Shot {index + 1} · {item.prefix}</strong>
                    <span className="field-hint">{shot.files.length} frames · {seconds}s</span>
                  </div>
                  <ShotFramePreview key={`${item.prefix}-${selectionEpoch}`}
                    files={shot.files} prefix={item.prefix} fps={fps} disabled={busy} />
                  <ShotBeatEditor beat={storyBeats[item.prefix] ??
                    emptyShotBeat(item.prefix)} shotSeconds={seconds}
                    disabled={busy} onChange={changeBeat} />
                  <SubtitleCueEditor prefix={item.prefix} shotSeconds={seconds}
                    narration={storyBeats[item.prefix]?.narration ?? ""}
                    adjustment={subtitleEdits[item.prefix]}
                    disabled={busy}
                    onChange={next => changeSubtitleEdit(item.prefix, next)} />
                  <div className="studio-shot-actions">
                    <button type="button" className="button secondary small"
                      aria-label={`Move ${item.prefix} earlier`}
                      disabled={busy || index === 0}
                      onClick={() => moveShot(index, -1)}>Move earlier</button>
                    <button type="button" className="button secondary small"
                      aria-label={`Move ${item.prefix} later`}
                      disabled={busy || index === arranged.length - 1}
                      onClick={() => moveShot(index, 1)}>Move later</button>
                    <label>
                      Hold final frame
                      <select aria-label={`Hold final frame of ${item.prefix}`}
                        disabled={busy} value={item.holdSeconds}
                        onChange={event => holdShot(item.prefix,
                          Number(event.target.value) as 0 | 1 | 2 | 3)}>
                        {[0, 1, 2, 3].map(value =>
                          <option key={value} value={value}>
                            {value === 0 ? "No extra pause" : `+${value} second${value === 1 ? "" : "s"}`}
                          </option>)}
                      </select>
                    </label>
                  </div>
                </li>
              );
            })}
          </ol>
          <StoryReelPlayer key={`${selectionEpoch}-${fps}-${arranged.map(
            item => `${item.prefix}:${item.holdSeconds}`).join("|")}`}
            plan={planStoryReel(shots, fps, arranged)}
            beats={arranged.map(item => storyBeats[item.prefix] ??
              emptyShotBeat(item.prefix))}
            adjustments={activeSubtitleEdits}
            disabled={busy} />
          <div className="studio-voice-cue-download">
            <h4>Recording script · before import</h4>
            <p className="field-hint">
              Download a text-only cue sheet with each shot's real start/end
              time, action notes and written narration. Your story, PNGs and
              recordings stay local. This is not speech audio.
            </p>
            <div className="studio-script-download-actions">
              <button type="button" className="button secondary small"
                disabled={busy || !!displayedError || !canCreate}
                onClick={downloadVoiceCues}>
                Download voice cue sheet (.txt)
              </button>
              <button type="button" className="button secondary small"
                disabled={busy || !!displayedError || !canCreate || !hasSubtitleDraft}
                onClick={downloadSubtitleDraft}>
                Download subtitle draft (.srt)
              </button>
            </div>
            <p className="field-hint">
              By default subtitles cover whole shots. You can optionally
              edit one or two caption cues per shot and move their split time.
              Drafts still require review against real recorded voices before publishing.
            </p>
            <label className="studio-import-captions-optin">
              <input type="checkbox" checked={includeDraftCaptions}
                disabled={busy || (!hasSubtitleDraft && !includeDraftCaptions)}
                onChange={event => {
                  setIncludeDraftCaptions(event.target.checked);
                  setError("");
                }} />
              Include drafted subtitles as editable captions in the NEW cartoon
            </label>
            <p className="field-hint">
              Optional: add the reviewed text and timings to the new cartoon's
              normal caption editor and export. This creates no spoken audio
              and never changes existing cartoons. Each imported subtitle
              must be 280 characters or shorter; longer text is rejected
              without cutting off your writing.
            </p>
          </div>
        </section>
      )}
      <p role="status" className="field-hint">
        {multiShot && arranged.length
          ? `${arranged.length} shots in order: ${arranged.map(item => {
              const shot = shots.find(candidate => candidate.prefix === item.prefix)!;
              return `${item.prefix} (${shot.files.length} frames, +${item.holdSeconds}s hold)`;
            }).join(" → ")}. Total ${totalSeconds} seconds.`
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
