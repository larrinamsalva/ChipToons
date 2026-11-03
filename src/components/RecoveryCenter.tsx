import { useEffect, useRef, useState } from "react";
import { browserLocks } from "../edit-locks";
import { episodePackage, verifyBackupFile } from "../episode-package";
import { downloadBlob, safeFilename } from "../files";
import type { AudioAsset } from "../media-model";
import type { Project } from "../model";
import { cleanOriginals, recoverOriginal, recoveryInventory, verifiedRecording } from "../recovery";
import type { Recording, RecoveryInventory } from "../recovery";
import { Modal } from "./Modal";

type Panel = "projects" | "recordings" | "storage";
const sizeLabel = (bytes: number) => bytes >= 1048576
  ? `${(bytes / 1048576).toFixed(1)} MB`
  : bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} bytes`;
const format = (recording: Recording) => recording.source.mime === "audio/mpeg"
  ? "mp3" : recording.source.mime.split("/")[1];
const errorText = (error: unknown) => (error instanceof Error || error instanceof DOMException) && error.name === "QuotaExceededError"
  ? "Browser storage is full. Download a backup or original recording before reviewing storage."
  : error instanceof Error ? error.message : "Local storage could not be checked. Your cartoons and recordings are unchanged.";

export function RecoveryCenter({ onClose, onRestore, onOpenReadOnly, onProjectsChanged }: {
  onClose: () => void;
  onRestore: () => void;
  onOpenReadOnly: (project: Project) => void;
  onProjectsChanged: () => void;
}) {
  const [inventory, setInventory] = useState<RecoveryInventory>();
  const [panel, setPanel] = useState<Panel>("projects");
  const [message, setMessage] = useState("Reading local projects and recordings…");
  const [busy, setBusy] = useState(true);
  const [damaged, setDamaged] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState(false);
  const [estimate, setEstimate] = useState<StorageEstimate>();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [preview, setPreview] = useState<{ id: string; url: string }>();
  const previewUrl = useRef<string | undefined>(undefined);
  const [attach, setAttach] = useState<Recording>();
  const [targetId, setTargetId] = useState("");
  const [repairId, setRepairId] = useState("");
  const [repairFile, setRepairFile] = useState<File>();
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [review, setReview] = useState<Recording[]>();
  const verify = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void recoveryInventory().then(next => {
      if (active) {
        setInventory(next);
        setMessage("Saved cartoons and recordings are ready to review.");
      }
    }).catch(error => { if (active) setMessage(errorText(error)); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
  }, []);

  async function run(task: () => Promise<string>) {
    setBusy(true);
    try { setMessage(await task()); }
    catch (error) { setMessage(errorText(error)); }
    finally { setBusy(false); }
  }
  async function refresh() {
    const next = await recoveryInventory();
    setInventory(next);
    setChecked(false);
    return next;
  }
  function clearPreview() {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = undefined;
    setPreview(undefined);
  }
  function changePanel(next: Panel) {
    clearPreview();
    setReview(undefined);
    setPanel(next);
    if (next === "storage") void run(async () => {
      await refresh();
      setSelection(new Set());
      setEstimate(await navigator.storage?.estimate?.().catch(() => undefined));
      return "Storage review is ready. Choose individual originals to preview cleanup.";
    });
  }
  function checkProjects() {
    setPanel("projects");
    void run(async () => {
      const next = await refresh();
      const failed = new Set<string>();
      for (const [index, recording] of next.recordings.entries()) {
        setMessage(`Checking original ${index + 1} of ${next.recordings.length}…`);
        try { await verifiedRecording(recording); }
        catch { failed.add(recording.id); }
      }
      setDamaged(failed);
      setChecked(true);
      return next.missing.length || failed.size || next.invalid
        ? "Some originals need attention. Review the warnings below."
        : "All listed originals passed their integrity checks.";
    });
  }
  function openRecording(recording: Recording, download: boolean) {
    void run(async () => {
      const blob = await verifiedRecording(recording);
      if (download) downloadBlob(blob, `${safeFilename(recording.source.name)}.${format(recording)}`);
      else {
        clearPreview();
        const url = URL.createObjectURL(blob);
        previewUrl.current = url;
        setPreview({ id: recording.id, url });
      }
      return download ? "Original recording downloaded." : "Original recording ready to preview.";
    });
  }
  function backup(project: Project) {
    void run(async () => {
      const packageNeeded = project.audioAssets.some(asset => asset.file);
      const blob = packageNeeded
        ? await episodePackage(project, { onProgress: detail => setMessage(detail.phase) })
        : new Blob([JSON.stringify(project)], { type: "application/json" });
      downloadBlob(blob, `${safeFilename(project.title)}.${packageNeeded ? "ctepisode" : "chiptoons.json"}`);
      return "Complete backup ready. Check your browser downloads and keep a copy outside this browser.";
    });
  }

  const needsRepair = [...(inventory?.missing ?? [])];
  for (const recording of inventory?.recordings ?? []) {
    if (!recording.source.file || !damaged.has(recording.id)) continue;
    for (const ref of recording.references)
      if (!needsRepair.some(other => other.projectId === ref.projectId && other.asset.id === ref.asset.id))
        needsRepair.push(ref);
  }
  const repairKey = (ref: (typeof needsRepair)[number]) => `${ref.projectId}:${ref.asset.id}`;
  const replacement = needsRepair.find(ref => repairKey(ref) === repairId);
  const candidates = inventory?.recordings.filter(recording => recording.candidate && !damaged.has(recording.id)) ?? [];
  const selected = candidates.filter(recording => selection.has(recording.id));
  const visible = inventory?.recordings.filter(recording => {
    const label = [recording.source.name, format(recording), ...recording.references.map(ref => ref.projectTitle)].join(" ").toLowerCase();
    return label.includes(query.trim().toLowerCase()) &&
      (filter === "all" || (filter === "referenced" && recording.references.length > 0) ||
       (filter === "retained" && !recording.references.length) || (filter === "damaged" && damaged.has(recording.id)));
  }) ?? [];

  function reconnect(input: Recording | File, projectId: string, target?: AudioAsset) {
    void run(async () => {
      await recoverOriginal(projectId, input, target);
      await refresh();
      onProjectsChanged();
      setAttach(undefined);
      setRepairFile(undefined);
      setRepairId("");
      return target ? "The exact original was reconnected. Clip timing is unchanged."
        : "Recording added to the cartoon. Open Voices & Sound to use it in a scene.";
    });
  }

  return (
    <Modal title="Project & Media Recovery" onClose={() => { if (!busy) onClose(); }} wide>
      <p>Find original recordings, check your cartoons, and keep backups you can restore later.</p>
      <nav aria-label="Recovery sections" className="recovery-actions">
        <button className="button secondary" disabled={busy} aria-pressed={panel === "projects"} onClick={checkProjects}>Check My Projects</button>
        <button className="button secondary" disabled={busy} aria-pressed={panel === "recordings"} onClick={() => changePanel("recordings")}>Find My Recordings</button>
        <button className="button secondary" disabled={busy} aria-pressed={panel === "storage"} onClick={() => changePanel("storage")}>Review Storage</button>
      </nav>
      <p className="recovery-status" role="status" aria-live="polite">{message}</p>
      <div className="recovery-actions">
        <button className="button secondary" disabled={busy} onClick={() => verify.current?.click()}>Verify Backup File</button>
        <input type="file" accept=".ctepisode,.json" ref={verify} className="visually-hidden" tabIndex={-1} aria-label="Backup file to verify" onChange={event => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void run(async () => {
            const result = await verifyBackupFile(file, { onProgress: detail => setMessage(detail.phase) });
            return `Backup verified for “${result.title}” with ${result.scenes} scenes and ${result.originals} file-backed originals. Verification checked this file. It cannot confirm your external storage is safe.`;
          });
        }} />
        <button className="button secondary" disabled={busy} onClick={onRestore}>Restore a Backup as a Copy</button>
      </div>

      {panel === "projects" && inventory && (
        <section className="recovery-section" aria-label="Saved cartoons">
          <h3>Saved cartoons and backup health</h3>
          <p>Project sizes are estimates. Shared recordings can count toward more than one cartoon.</p>
          {inventory.projects.length === 0 && <p>No cartoons are saved in this browser yet.</p>}
          <ul className="recovery-list">
            {inventory.projects.map(({ project, lastSave, bytes }) => {
              const broken = needsRepair.some(ref => ref.projectId === project.id)
                || inventory.recordings.some(recording => damaged.has(recording.id) &&
                  recording.references.some(ref => ref.projectId === project.id));
              return (
                <li className="recovery-card" key={project.id}>
                  <strong>{project.title}</strong>
                  <p>{sizeLabel(bytes)} · {lastSave ? `Last saved ${new Date(lastSave).toLocaleString()}` : `Saved version dated ${new Date(project.updatedAt).toLocaleString()}`}</p>
                  <p>{broken ? "Originals need attention before this cartoon can make a complete backup."
                    : checked ? "Originals passed their integrity checks. Use Download Complete Backup to prepare your file."
                      : "No missing original links found. The originals are checked when you download a backup."}</p>
                  <div className="recovery-actions">
                    <button className="button secondary" disabled={busy || broken} aria-label={`Download Complete Backup for ${project.title}`} onClick={() => backup(project)}>Download Complete Backup</button>
                    <button className="button secondary" disabled={busy} aria-label={`Open Read-Only for ${project.title}`} onClick={() => onOpenReadOnly(project)}>Open Read-Only</button>
                  </div>
                </li>
              );
            })}
          </ul>
          {needsRepair.length > 0 && (
            <div className="recovery-card">
              <h4>Reconnect a missing or damaged original</h4>
              <p>Choose the identical original. ChipToons checks the file before reconnecting it.</p>
              <label>Source to repair
                <select value={repairId} disabled={busy} onChange={event => { setRepairId(event.target.value); setRepairFile(undefined); }}>
                  <option value="">Choose a source</option>
                  {needsRepair.map(ref => <option key={repairKey(ref)} value={repairKey(ref)}>{ref.projectTitle} · {ref.asset.name}</option>)}
                </select>
              </label>
              {replacement && <>
                <label>Choose identical audio file
                  <input type="file" accept="audio/*,.wav,.mp3,.webm,.ogg" disabled={busy} onChange={event => setRepairFile(event.currentTarget.files?.[0])} />
                </label>
                <button className="button primary" disabled={busy || !repairFile} onClick={() => repairFile && reconnect(repairFile, replacement.projectId, replacement.asset)}>Reconnect Exact Original</button>
                {inventory.recordings.filter(item => item.source.file?.sha256 === replacement.asset.file?.sha256 &&
                  item.bytes === replacement.asset.file?.size && item.source.mime === replacement.asset.mime &&
                  item.id !== replacement.asset.file?.key && !damaged.has(item.id)).map(item => (
                  <button className="button secondary" key={item.id} disabled={busy} onClick={() => reconnect(item, replacement.projectId, replacement.asset)}>Reconnect Retained Original: {item.source.name}</button>
                ))}
              </>}
            </div>
          )}
        </section>
      )}

      {panel === "recordings" && inventory && (
        <section className="recovery-section" aria-label="Original recordings">
          <h3>Original recordings</h3>
          <div className="recovery-actions">
            <label>Search recordings<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>
            <label>Filter recordings
              <select value={filter} onChange={event => setFilter(event.target.value)}>
                <option value="all">All recordings</option>
                <option value="referenced">Used in saved cartoons</option>
                <option value="retained">Unreferenced retained originals</option>
                <option value="damaged">Failed integrity check</option>
              </select>
            </label>
          </div>
          {inventory.invalid > 0 && <p>{inventory.invalid} damaged or unreadable original records are protected from cleanup.</p>}
          {visible.length === 0 && <p>No recordings match this view.</p>}
          <ul className="recovery-list">
            {visible.map(item => (
              <li key={item.id} className="recovery-card">
                <strong>{item.source.name}</strong>
                <p>{format(item).toUpperCase()} · {sizeLabel(item.bytes)} · {item.storedAt ? `Stored ${new Date(item.storedAt).toLocaleDateString()}` : "Storage date unknown"}</p>
                <p>{item.references.length
                  ? `Used in ${[...new Set(item.references.map(ref => ref.projectTitle))].join(", ")}`
                  : "Unreferenced retained original. Origin unknown."}</p>
                {damaged.has(item.id) && <p>Failed integrity check. Use an identical original to repair its project link.</p>}
                <div className="recovery-actions">
                  <button className="button secondary" disabled={busy || damaged.has(item.id)} onClick={() => openRecording(item, false)}>Preview Recording</button>
                  <button className="button secondary" disabled={busy || damaged.has(item.id)} onClick={() => openRecording(item, true)}>Download Original</button>
                  <button className="button secondary" disabled={busy || damaged.has(item.id) || !inventory.projects.length} onClick={() => { setAttach(item); setTargetId(""); }}>Recover into a Cartoon</button>
                </div>
                {preview?.id === item.id && <audio controls src={preview.url} aria-label={`Preview ${item.source.name}`} onError={() => setMessage("This browser cannot play that format. You can still download the original.")} />}
                {attach?.id === item.id && (
                  <div className="recovery-actions">
                    <label>Cartoon to receive the recording
                      <select value={targetId} onChange={event => setTargetId(event.target.value)} disabled={busy}>
                        <option value="">Choose a cartoon</option>
                        {inventory.projects.map(({ project }) => <option key={project.id} value={project.id}>{project.title}</option>)}
                      </select>
                    </label>
                    <button className="button primary" disabled={busy || !targetId} onClick={() => reconnect(item, targetId)}>Add Original as an Audio Source</button>
                    <button className="button secondary" disabled={busy} onClick={() => setAttach(undefined)}>Cancel Recovery</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {panel === "storage" && inventory && (
        <section className="recovery-section" aria-label="Storage and cleanup">
          <h3>Storage and cleanup</h3>
          {estimate?.quota !== undefined && estimate.usage !== undefined
            ? <p>Browser estimate for this site: {sizeLabel(estimate.usage)} used of {sizeLabel(estimate.quota)} available quota.</p>
            : <p>This browser did not provide a storage estimate.</p>}
          <p>{sizeLabel(inventory.recordings.filter(item => item.source.file).reduce((sum, item) => sum + item.bytes, 0))} of file-backed originals are listed. {inventory.missing.length} missing or mismatched links and {inventory.invalid} unreadable records.</p>
          <p>Some unreferenced originals may belong to an unfinished take or a deleted cartoon. ChipToons protects originals with no known saved history and originals that failed an integrity check.</p>
          {!browserLocks() && <p>Use a current browser with tab coordination to remove originals.</p>}
          {candidates.length === 0 && <p>No originals are currently available to select for cleanup.</p>}
          {!review && <>
            <ul className="recovery-list">
              {candidates.map(item => (
                <li className="recovery-card" key={item.id}>
                  <label className="recovery-check">
                    <input type="checkbox" disabled={busy} checked={selection.has(item.id)} onChange={event => {
                      const next = new Set(selection);
                      if (event.target.checked) next.add(item.id);
                      else next.delete(item.id);
                      setSelection(next);
                    }} />
                    {item.source.name} · {sizeLabel(item.bytes)}
                  </label>
                </li>
              ))}
            </ul>
            <button className="button secondary" disabled={busy || !selected.length} onClick={() => { setReview(selected); setMessage("Cleanup preview ready. No files have been removed."); }}>Review Cleanup</button>
          </>}
          {review && (
            <div className="recovery-card" role="group" aria-labelledby="cleanup-heading">
              <h4 id="cleanup-heading">Confirm permanent removal</h4>
              <p>{review.length} selected originals, about {sizeLabel(review.reduce((sum, item) => sum + item.bytes, 0))}.</p>
              <ul>{review.map(item => <li key={item.id}>{item.source.name} · {format(item).toUpperCase()}</li>)}</ul>
              <p>Download complete cartoon backups and copies of these originals first. ChipToons cannot verify any backups outside this browser. Close other open cartoon editors before confirming.</p>
              <div className="recovery-actions">
                <button className="button secondary" disabled={busy} onClick={() => { setReview(undefined); setMessage("Cleanup cancelled. No files were removed."); }}>Cancel Cleanup</button>
                <button className="button danger" disabled={busy || !browserLocks()} onClick={() => void run(async () => {
                  const result = await cleanOriginals(inventory, review);
                  setReview(undefined);
                  setSelection(new Set());
                  await refresh().catch(() => { setInventory(undefined); });
                  setEstimate(await navigator.storage?.estimate?.().catch(() => undefined));
                  return `Removed ${result.count} original ${result.count === 1 ? "recording" : "recordings"} after confirmation. About ${sizeLabel(result.bytes)} of audio data removed.`;
                })}>Permanently Remove Selected Originals</button>
              </div>
            </div>
          )}
        </section>
      )}
    </Modal>
  );
}
