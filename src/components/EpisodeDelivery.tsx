import { useEffect, useRef, useState } from "react";
import type { Project } from "../model";
import { durationLabel } from "../model";
import { planSegments } from "../segments";
import type { ExportSegment } from "../segments";
import { exportLimit, verifyVideo } from "../video-export";
import { srt } from "../production";
import { downloadBlob, safeFilename } from "../files";
import { checkDeliveryAbort, deliveryDigest } from "../delivery-bytes";
import {
  checkEpisodePackage, deliveryFilename, exportReceipts, inspectDeliveryFile, makeEpisodeZip,
  partProblem, partTag, prepareDelivery, reviewDelivery, suggestPart,
} from "../episode-delivery";
import type { DeliveryFile, DeliveryPlayerPart } from "../episode-delivery";
import { DeliveryPlayer } from "./DeliveryPlayer";
import { MediaNumber } from "./MediaNumber";

const MIB = 1024 * 1024;
const mb = (bytes: number) => `${(bytes / MIB).toFixed(1)} MiB`;
type RejectedFile = { id: number; name: string; reason: string };
type Progress = { label: string; done: number; total: number };

function AssignFile({ file, plan, assignments, onAssign, onRemove }: {
  file: DeliveryFile; plan: ExportSegment[]; assignments: Record<number, string>;
  onAssign: (index: number) => void; onRemove: () => void;
}) {
  const suggestion = suggestPart(file, plan);
  const [selected, setSelected] = useState(suggestion === undefined ? "" : String(suggestion));
  return <div className="delivery-card">
    <strong>{file.file.name}</strong>
    <p>{file.receipt ? "An exact export was recorded for this file. Assign it to its matching scene range." :
      suggestion === undefined ? "The file name does not identify its place. Preview the file before assigning it." :
        `The file name suggests part ${suggestion + 1}. Confirm where it belongs.`}</p>
    <label>Assign {file.file.name} to
      <select value={selected} onChange={event => setSelected(event.target.value)}>
        <option value="">Choose a part</option>
        {plan.map((segment, index) => <option key={segment.id} value={index} disabled={!!assignments[index]}>
          Part {index + 1} · scenes {segment.firstScene + 1}–{segment.lastScene + 1}
        </option>)}
      </select>
    </label>
    <div className="delivery-actions">
      <button className="button secondary" disabled={selected === "" || !!assignments[Number(selected)]}
        onClick={() => onAssign(Number(selected))}>Confirm part assignment</button>
      <button className="button secondary" onClick={onRemove}>Remove {file.file.name}</button>
    </div>
  </div>;
}

export function EpisodeDelivery({ project, initialLimit, initialAudio, active, onBack, onReExport }: {
  project: Project; initialLimit: number; initialAudio: boolean; active: boolean;
  onBack: () => void; onReExport: (segment: ExportSegment, index: number) => void;
}) {
  const [limit, setLimit] = useState(initialLimit);
  const [expectAudio, setExpectAudio] = useState(initialAudio);
  const [files, setFiles] = useState<DeliveryFile[]>([]);
  const [rejected, setRejected] = useState<RejectedFile[]>([]);
  const [assignments, setAssignments] = useState<Record<number, string>>({});
  const [progress, setProgress] = useState<Progress>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [packageResult, setPackageResult] = useState<Awaited<ReturnType<typeof checkEpisodePackage>>>();
  const [watch, setWatch] = useState<"current" | "package">();
  const [preview, setPreview] = useState<DeliveryFile>();
  const batch = useRef<HTMLInputElement>(null);
  const chooseButton = useRef<HTMLButtonElement>(null);
  const replacement = useRef<HTMLInputElement>(null);
  const packageInput = useRef<HTMLInputElement>(null);
  const replaceIndex = useRef(-1);
  const nextRejected = useRef(0);
  const controller = useRef<AbortController | undefined>(undefined);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; controller.current?.abort(); };
  }, []);
  useEffect(() => {
    if (active) chooseButton.current?.focus();
  }, [active]);
  const { segments, oversized } = planSegments(project, limit);
  const review = reviewDelivery(segments, files, assignments, expectAudio);
  const subtitles = segments.map(segment => srt(project, segment));
  const ready = review.ready && !rejected.length;
  const total = project.scenes.reduce((length, scene) => length + scene.duration, 0);
  const maxZip = (matchMedia("(max-width:740px)").matches ? 256 : 512) * MIB;
  const assignedCount = review.rows.filter(row => row.file).length;
  const bytes = review.rows.reduce((size, row) => size + (row.file?.file.size ?? 0), 0);
  const currentParts: DeliveryPlayerPart[] = review.rows.flatMap(({ segment, file, index }) => file ? [{
    label: `Part ${index + 1} · scenes ${segment.firstScene + 1}–${segment.lastScene + 1}`,
    start: segment.start, end: segment.end, video: file.file,
    subtitle: subtitles[index] ? new Blob([subtitles[index]]) : undefined, baked: file.receipt?.captions,
  }] : []);

  async function work(label: string, total: number, action: (signal: AbortSignal) => Promise<void>) {
    if (controller.current) return;
    const task = new AbortController();
    controller.current = task;
    setProgress({ label, done: 0, total });
    setError("");
    setNotice("");
    try {
      await action(task.signal);
    } catch (problem) {
      if (alive.current) {
        if (task.signal.aborted) setNotice("Cancelled. Your delivery list and cartoon are unchanged.");
        else setError(problem instanceof Error ? problem.message : "This operation could not finish. Try a smaller selection.");
      }
    } finally {
      controller.current = undefined;
      if (alive.current) setProgress(undefined);
    }
  }

  function collect(picked: File[], target?: number) {
    if (!picked.length) return;
    if (picked.length > 120 || files.length + rejected.length + picked.length > (target === undefined ? 120 : 121)) {
      setError("Choose at most 120 parts. Remove unused files before adding more.");
      return;
    }
    void work("Checking video files", picked.length, async signal => {
      const next = [...files], invalid = [...rejected], placement = { ...assignments };
      const receipts = exportReceipts(project);
      let checked = 0;
      for (const file of picked) {
        try {
          const result = await inspectDeliveryFile(file, receipts, verifyVideo, signal);
          const previous = target === undefined ? undefined : placement[target];
          if (next.some(item => item.sha256 === result.sha256 && item.sha256 !== previous))
            throw new Error("These exact video bytes are already in the delivery list.");
          if (target !== undefined) {
            const problem = partProblem(result, segments[target], expectAudio);
            if (problem) throw new Error(problem);
            if (previous) next.splice(next.findIndex(item => item.sha256 === previous), 1);
            placement[target] = result.sha256;
          } else if (result.receipt) {
            const expected = suggestPart(result, segments);
            if (expected !== undefined && !placement[expected] &&
                !partProblem(result, segments[expected], expectAudio)) placement[expected] = result.sha256;
          }
          next.push(result);
        } catch (problem) {
          checkDeliveryAbort(signal);
          invalid.push({ id: ++nextRejected.current, name: file.name,
            reason: problem instanceof Error ? problem.message : "This file could not be checked." });
        }
        if (alive.current) setProgress({ label: "Checking video files", done: ++checked, total: picked.length });
      }
      checkDeliveryAbort(signal);
      if (!alive.current) return;
      setFiles(next);
      setAssignments(placement);
      setRejected(invalid);
      setNotice(`${checked} selected file${checked === 1 ? "" : "s"} checked.`);
    });
  }

  function checkParts() {
    const total = files.reduce((n, item) => n + item.file.size, 0);
    void work("Rechecking selected video parts", total, async signal => {
      let done = 0;
      for (const file of files) {
        try {
          const digest = await deliveryDigest(file.file, signal, count => {
            done += count;
            if (alive.current) setProgress({ label: "Rechecking selected video parts", done, total });
          });
          if (digest.sha256 !== file.sha256 || digest.crc32 !== file.crc32) throw new Error("Bytes changed.");
        } catch {
          checkDeliveryAbort(signal);
          if (alive.current) {
            removeFile(file.sha256);
            const rejected = { id: ++nextRejected.current, name: file.file.name, reason: "This file changed or could not be read again." };
            setRejected(previous => [...previous, rejected]);
          }
          throw new Error(`Choose ${file.file.name} again before delivery.`);
        }
      }
      if (alive.current) setNotice(ready
        ? "Selected files still match their checked bytes and the part list is complete."
        : "Selected bytes checked. Review the missing, invalid or unassigned entries below.");
    });
  }

  function removeFile(sha: string) {
    setFiles(previous => previous.filter(file => file.sha256 !== sha));
    setAssignments(previous => Object.fromEntries(Object.entries(previous).filter(([, digest]) => digest !== sha)));
    setError("");
  }

  function pickPart(index: number) {
    replaceIndex.current = index;
    replacement.current?.click();
  }

  function download(kind: "zip" | "manifest" | "readme") {
    void work("Preparing delivery files", bytes, async signal => {
      let done = 0;
      const prepared = await prepareDelivery(project, segments, files, assignments, expectAudio, subtitles, signal, count => {
        done += count;
        if (alive.current) setProgress({ label: "Preparing delivery files", done, total: bytes });
      });
      checkDeliveryAbort(signal);
      if (!alive.current) return;
      const title = safeFilename(project.title);
      const blob = kind === "zip" ? makeEpisodeZip(prepared, maxZip) :
        kind === "readme" ? prepared.entries[0].blob : prepared.text;
      downloadBlob(blob, kind === "zip" ? deliveryFilename(project.title) :
        kind === "readme" ? "README.txt" : `${title}-part-order.json`);
      setNotice(kind === "zip" ? "The checked delivery ZIP is ready and the download was started." :
        kind === "readme" ? "The playback README download was started." : "The complete order and checksum manifest download was started.");
    });
  }

  function checkPackage(file?: File) {
    if (!file) return;
    setPackageResult(undefined);
    void work("Checking the ZIP and every listed checksum", file.size, async signal => {
      let done = 0;
      const result = await checkEpisodePackage(file, maxZip, signal, count => {
        done += count;
        if (alive.current) setProgress({ label: "Checking the ZIP and every listed checksum", done, total: file.size });
      });
      if (alive.current) {
        setPackageResult(result);
        setNotice("Package structure, order, sizes and checksums passed.");
      }
    });
  }

  const selectedParts = watch === "package" ? packageResult?.parts : currentParts;
  if (active && watch && selectedParts?.length) return <DeliveryPlayer
    parts={selectedParts} title={watch === "package" ? packageResult!.manifest.title : project.title}
    onClose={() => setWatch(undefined)} />;
  if (active && preview) return <DeliveryPlayer
    parts={[{ label: preview.file.name, start: 0, end: preview.media.duration, video: preview.file }]}
    title="Review an unassigned file" onClose={() => setPreview(undefined)} />;

  return <div className="delivery-studio">
    <p>Choose the actual WebM files from your device. Your browser cannot retrieve your downloads automatically.</p>
    <p><strong>{project.title}</strong> · {durationLabel(total)} planned · {project.scenes.length} scenes · {segments.length} expected parts</p>
    <p>{files.length + rejected.length} files loaded for this session</p>
    <p role="status">{assignedCount} of {segments.length} parts assigned · {review.rows.filter(row => !row.file).length} missing · {
      rejected.length + review.rows.filter(row => row.file && row.issue).length
    } invalid · {subtitles.filter(Boolean).length} subtitle files · {ready ? "Ready for delivery" : "Delivery needs review"}</p>
    {error && <p className="media-notice" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {progress && <div className="delivery-card">
      <p role="status">{progress.label}</p>
      <progress aria-label="Delivery progress" value={progress.done} max={progress.total || 1} />
      <button className="button secondary" onClick={() => controller.current?.abort()}>Cancel delivery operation</button>
    </div>}
    <input hidden aria-label="Choose video files" type="file" multiple accept=".webm,video/webm" ref={batch} onChange={event => {
      collect(Array.from(event.target.files ?? []));
      event.target.value = "";
    }} />
    <input hidden aria-label="Choose one replacement video" type="file" accept=".webm,video/webm" ref={replacement} onChange={event => {
      collect(Array.from(event.target.files ?? []), replaceIndex.current);
      event.target.value = "";
    }} />
    <input hidden aria-label="Choose a delivery package" type="file" accept=".zip,application/zip" ref={packageInput} onChange={event => {
      checkPackage(event.target.files?.[0]);
      event.target.value = "";
    }} />
    <fieldset disabled={!!progress} className="delivery-fields">
      <legend className="visually-hidden">Episode delivery files and actions</legend>
      <div className="delivery-actions">
        <button className="button primary" ref={chooseButton} disabled={!segments.length} onClick={() => batch.current?.click()}>Choose My Video Parts</button>
        <button className="button secondary" disabled={!files.length} onClick={checkParts}>Check Parts</button>
        <button className="button secondary" onClick={() => packageInput.current?.click()}>Check an Episode Package</button>
        <button className="button secondary" onClick={onBack}>Back to exports</button>
      </div>
      <details>
        <summary>Review Part Order and export settings</summary>
        <p>Use the same part limit you used for the original exports. Changing it keeps your files and asks you to assign them again.</p>
        <MediaNumber label="Original seconds per segment" min={2} max={120} step={1} value={limit} onChange={value => {
          setLimit(value);
          setAssignments({});
          setNotice("The part plan changed. Review and assign the loaded files again.");
        }} />
        <label className="inline-check"><input type="checkbox" checked={expectAudio}
          onChange={event => setExpectAudio(event.target.checked)} /> Require audio on files without an exact export match</label>
      </details>
      {!!oversized.length && <p className="media-notice" role="alert">Some whole scenes exceed this limit. Restore the original part limit or review those scenes in the exporter.</p>}
      {packageResult && <div className="delivery-card">
        <h3>Package checks passed</h3>
        <p>{packageResult.manifest.title} · {packageResult.parts.length} ordered video parts · {durationLabel(packageResult.manifest.seconds)}</p>
        <p>The package contents match their listed checksums. This does not authenticate the creator or prove scene identity.</p>
        <button className="button secondary" onClick={() => setWatch("package")}>Watch Checked Package</button>
      </div>}
      {!!rejected.length && <section className="delivery-card" aria-label="Invalid and duplicate files">
        <h3>Invalid or duplicate files</h3>
        <ul>{rejected.map(file => <li key={file.id}>
          <strong>{file.name}</strong> · {file.reason}{" "}
          <button className="button secondary small" onClick={() =>
            setRejected(previous => previous.filter(item => item.id !== file.id))}>Remove rejected file {file.name}</button>
        </li>)}</ul>
      </section>}
      {!!review.extras.length && <section className="delivery-stack" aria-label="Files to assign">
        <h3>Unassigned files</h3>
        {review.extras.map(file => <div className="delivery-stack" key={`${limit}:${file.sha256}`}>
          <AssignFile file={file} plan={segments} assignments={assignments}
            onRemove={() => removeFile(file.sha256)} onAssign={index => {
              const problem = partProblem(file, segments[index], expectAudio);
              if (problem) setError(problem);
              else { setAssignments(previous => ({ ...previous, [index]: file.sha256 })); setError(""); }
            }} />
          <button className="button secondary" onClick={() => setPreview(file)}>Preview {file.file.name}</button>
        </div>)}
      </section>}
      {review.compatibility && <p className="media-notice" role="alert">The video codec, dimensions, known frame rates, or audio codecs differ. Replace or re-export the affected part with matching settings.</p>}
      {review.duplicate && <p className="media-notice" role="alert">One video is assigned more than once. Review the part list.</p>}
      <ol className="delivery-parts" aria-label="Expected part order">
        {review.rows.map(({ segment, index, file, issue }) => <li className="delivery-card" key={segment.id}>
          <strong>Part {index + 1} · scenes {segment.firstScene + 1}–{segment.lastScene + 1}</strong>
          <p>{durationLabel(segment.start)}–{durationLabel(segment.end)} · {segment.duration.toFixed(2)}s · {
            subtitles[index] ? "SRT available" : "No subtitles in this range"
          }</p>
          {file && <p>{file.file.name} · {file.media.codec} · {file.media.width}×{file.media.height} · {
            file.media.fps ? `${file.media.fps.toFixed(2)} fps (${file.media.fpsSource === "track" ? "track" : "export setting"})` : "Frame rate unverified"
          } · {file.media.audio ?? "No audio track"}</p>}
          {file && <p>{file.receipt ? "Exact recorded export match" : "Creator-assigned scene range"}</p>}
          {issue && <p className="media-notice">{issue}</p>}
          <div className="delivery-actions">
            <button className="button secondary small" onClick={() => pickPart(index)}>
              {file ? "Replace selected" : "Add missing"} part {index + 1}
            </button>
            {file && <>
              <button className="button secondary small" onClick={() => removeFile(file.sha256)}>Remove part {index + 1} from delivery list</button>
              <button className="button secondary small" onClick={() => downloadBlob(file.file, `${partTag(index, segment)}.webm`)}>Download checked part {index + 1}</button>
            </>}
            {subtitles[index] && <button className="button secondary small" onClick={() =>
              downloadBlob(new Blob([subtitles[index]]), `${partTag(index, segment)}.srt`)}>Part {index + 1} subtitles</button>}
            {issue && <button className="button secondary small" disabled={segment.duration > exportLimit()}
              onClick={() => onReExport(segment, index)}>Re-Export Missing Part {index + 1}</button>}
          </div>
          {issue && segment.duration > exportLimit() && <p>Re-export this exact range on a wider layout.</p>}
        </li>)}
      </ol>
      <p className="field-hint">Video checks read the container and start playback. A file name or similar duration alone does not prove the scenes match. Audio track presence does not check the spoken content.</p>
      <div className="delivery-actions">
        <button className="button primary" disabled={!ready} onClick={() => setWatch("current")}>Watch My Episode</button>
        <button className="button primary" disabled={!ready || bytes >= maxZip}
          onClick={() => download("zip")}>Download Episode Delivery Package</button>
        <button className="button secondary" disabled={!ready} onClick={() => download("manifest")}>Download Complete Manifest</button>
        <button className="button secondary" disabled={!ready} onClick={() => download("readme")}>Download Playback README</button>
      </div>
      <p>{mb(bytes)} of assigned video. The ZIP limit on this layout is {mb(maxZip)}. {
        bytes >= maxZip ? "Keep the separate WebM and SRT files with the complete manifest, or use a larger screen." :
          "If ZIP preparation runs out of space, keep the individual downloads with the complete manifest."
      }</p>
      <p className="field-hint">This package is for viewing finished movies. Keep a separate editable project backup for scenes, artwork and recordings.</p>
    </fieldset>
  </div>;
}
