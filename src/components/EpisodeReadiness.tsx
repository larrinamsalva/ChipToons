import { useEffect, useState } from "react";
import type { Project } from "../model";
import { missingAudio } from "../audio-vault";
import { clipStart } from "../production";
import { episodeCameraSummary } from "../episode-camera-review";
import { episodeCameraPunchList, cameraReviewTimecode } from "../episode-camera-punch-list";
import { cameraCoverageReview } from "../camera-coverage-review";
import { cameraVoiceSourceStatus } from "../episode-camera-voice-source";
import { sceneAssignedVoiceCoverage } from "../episode-voice-coverage";
import { episodeAssignedVoiceSummary } from "../episode-voice-summary";
import { episodeVoiceOriginalSummary } from "../episode-voice-original-summary";
import { voiceTimingBands } from "../voice-timing-strip";
import { downloadBlob, safeFilename } from "../files";
import { lineStatus } from "../script";
import { sceneStart } from "../timeline";
export function EpisodeReadiness({
  project,
  onReady,
  onScene,
}: {
  project: Project;
  onReady: (ready: boolean) => void;
  onScene: (index: number, panel?: "voices" | "captions" | "camera-review", inspectAt?: number, inspectKind?: "voice" | "gap" | "voice-unavailable", voiceClipId?: string) => void;
}) {
  const [missing, setMissing] = useState<string[]>([]),
    [checked, setChecked] = useState(!project.audioAssets.some((a) => a.file)),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    void missingAudio(project)
      .then((ids) => {
        if (alive) {
          setMissing(ids);
          setChecked(true);
          onReady(ids.length === 0);
        }
      })
      .catch(() => {
        if (alive) {
          setError(
            "Local originals could not be checked. Restore a complete episode backup or retry opening this review.",
          );
          onReady(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [project, onReady]);
  const missingSources = new Set(missing);
  const camera = episodeCameraSummary(project);
  const voiceSummary = episodeAssignedVoiceSummary(project);
  const originalSummary = episodeVoiceOriginalSummary(
    project, missingSources, checked, !!error,
  );
  // All timing comes from the same saved records used in the downloaded
  // worksheet. Disclosures stay collapsed by default in long episodes.
  const cameraDetails = project.scenes.map(scene => cameraCoverageReview(project, scene));
  const rows = project.scenes.map((scene, index) => {
    const start = sceneStart(project, index),
      voice = project.audioClips.filter(
        (c) =>
          ["narration", "dialogue"].includes(c.category) &&
          !c.muted &&
          c.volume > 0 &&
          clipStart(project, c) < start + scene.duration &&
          clipStart(project, c) + c.duration > start,
      );
    return {
      scene,
      index,
      start,
      voice,
      voiceCoverage: sceneAssignedVoiceCoverage(project, index),
      missing: voice.some((c) => missing.includes(c.assetId)),
      lineCount: scene.script?.lines.filter(line => line.text.trim()).length ?? 0,
      approved: scene.script?.lines.filter(line => line.text.trim() && lineStatus(project, line, missingSources) === "Approved").length ?? 0,
      captions: project.captions.filter((c) => c.sceneId === scene.id).length,
    };
  });
  return (
    <details className="episode-readiness" open={project.mediaVersion === 1}>
      <summary>
        Episode narration review ·{" "}
        {rows.filter((r) => r.voice.length && !r.missing).length}/{rows.length}{" "}
        scenes with assigned voices
      </summary>
      <p className="field-hint">
        Assigned voices, original-file availability and timed captions are
        checked separately. Review each scene’s performance before exporting; a
        short assigned clip does not mean the whole narration has been recorded.
      </p>
      <section role="region" aria-label="Episode voice coverage overview"
        className="episode-voice-overview">
        <p>
          <strong>Whole-episode assigned voice timing: {voiceSummary.assignedSeconds.toFixed(1)}/{voiceSummary.totalSeconds.toFixed(1)}s</strong>
          {" "}· {voiceSummary.intervalCount} interval(s) without assigned voice
        </p>
        <p className="field-hint">
          This overview counts only assigned dialogue and narration clip timing,
          not verified spoken words. Overlapping clips are counted once.
          No assigned voice does not prove silence, and an unassigned interval
          is not an export error or a required recording.
        </p>
        <p>
          <strong>Voice clips with indexed originals: {originalSummary.indexed}/{originalSummary.total}</strong>
          {" "}· {originalSummary.missing} missing · {originalSummary.unverified} unverified
        </p>
        <p className="field-hint">
          Each unique assigned recording counts once, including clips crossing
          scene boundaries. An indexed source is not proof of playable audio,
          spoken words or approval. Missing and unverified are distinct.
        </p>
        {(originalSummary.missing > 0 || originalSummary.unverified > 0) && (
          <details aria-label="Voice recordings needing original-source review">
            <summary>
              Review recordings needing original-source attention
              {" "}({originalSummary.missing + originalSummary.unverified})
            </summary>
            <ol>
              {originalSummary.issues.map((issue) => (
                <li key={issue.clipId}>
                  Scene {issue.sceneIndex + 1} · {issue.category}
                  {" "}· {issue.status === "missing" ? "Missing original" : "Original not verified"}
                  {" "}· <span className="field-hint">{issue.detail}</span>
                  {" "}
                  <button type="button" className="button secondary small"
                    aria-label={`Review original-source issue for ${issue.category} clip in scene ${issue.sceneIndex + 1}`}
                    onClick={() => onScene(
                      issue.sceneIndex, "voices", undefined, undefined, issue.clipId,
                    )}>
                    Review this recording in Sound Studio
                  </button>
                </li>
              ))}
            </ol>
            {originalSummary.missing + originalSummary.unverified > originalSummary.issues.length && (
              <p className="field-hint">
                Showing the first five recordings requiring attention.
                Review scene voice intervals for the remaining recordings.
              </p>
            )}
          </details>
        )}
        <details aria-label="Longest unassigned voice intervals">
          <summary>Review up to five longest intervals without assigned voice</summary>
          <ol>
            {voiceSummary.longestGaps.map((gap, i) => (
              <li key={`${gap.sceneIndex}-${gap.start}-${gap.end}`}>
                Scene {gap.sceneIndex + 1}: scene {cameraReviewTimecode(gap.start)}–{cameraReviewTimecode(gap.end)}
                {" "}· episode {cameraReviewTimecode(gap.episodeStart)}–{cameraReviewTimecode(gap.episodeEnd)}
                {" "}· {gap.duration.toFixed(1)}s
                {" "}
                <button type="button" className="button secondary small"
                  aria-label={`Review longest unassigned voice interval ${i + 1} in scene ${gap.sceneIndex + 1}`}
                  onClick={() => onScene(gap.sceneIndex, "voices", gap.start)}>
                  Open Sound Studio at this interval
                </button>
              </li>
            ))}
            {voiceSummary.longestGaps.length === 0 && (
              <li>Every scene has assigned voice clip timing, or the episode is empty. Listen to verify actual speech.</li>
            )}
          </ol>
        </details>
      </section>
      <section role="region" aria-label="Episode camera coverage review"
        className="episode-camera-review">
        <p>
          <strong>Whole-episode camera coverage: {camera.percent}% custom shots</strong>
          {" "}({camera.customSeconds.toFixed(1)} of {camera.seconds.toFixed(1)} seconds)
        </p>
        <p className="field-hint">
          These are saved camera shots across all scenes. Remaining seconds
          use the normal default camera, which is valid for preview and
          export. This report never changes your cartoon.
        </p>
        <div className="animation-actions">
          <button type="button" className="button secondary small"
            onClick={() => downloadBlob(
              new Blob([episodeCameraPunchList(project, {
                missing: missingSources, checked, checkFailed: !!error,
              })], {
                type: "text/plain;charset=utf-8",
              }),
              `${safeFilename(project.title)}-camera-review.txt`,
            )}>
            Download camera review checklist (.txt)
          </button>
        </div>
        <ol>
          {camera.scenes.map(item => {
            const timeline = cameraDetails[item.sceneIndex];
            const start = sceneStart(project, item.sceneIndex);
            return <li key={project.scenes[item.sceneIndex].id}>
              <span>
                Scene {item.sceneIndex + 1}: {item.customSeconds.toFixed(1)}/{item.seconds.toFixed(1)}s
                {" "}custom · {item.shotCount} shot(s) · {item.gapCount} default-camera interval(s)
                {item.voiceStarts > 0 &&
                  ` · ${item.defaultVoiceStarts} of ${item.voiceStarts} recorded voice starts use default camera`}
              </span>{" "}
              <details aria-label={`Camera timing details for scene ${item.sceneIndex + 1}`}>
                <summary>Show exact camera and voice times for scene {item.sceneIndex + 1}</summary>
                <p className="field-hint">
                  These are existing scene-local and episode timecodes.
                  The default camera is valid; recorded clip starts do not
                  confirm what was spoken or whether the file is available.
                </p>
                <ul aria-label={`Camera timeline moments for scene ${item.sceneIndex + 1}`}>
                  {timeline.gaps.length ? timeline.gaps.map((gap, index) => (
                    <li key={`gap-${index}`}>
                      Default camera: scene {cameraReviewTimecode(gap.start)}–{cameraReviewTimecode(gap.end)}
                      {" "}· episode {cameraReviewTimecode(start + gap.start)}–{cameraReviewTimecode(start + gap.end)}
                      {" "}
                      <button type="button" className="button secondary small"
                        aria-label={`Inspect default camera interval ${index + 1} in scene ${item.sceneIndex + 1}`}
                        onClick={() => onScene(item.sceneIndex, "camera-review", (gap.start + gap.end) / 2, "gap")}>
                        Inspect gap
                      </button>
                    </li>
                  )) : <li>No default-camera intervals in this scene.</li>}
                  {timeline.voices.length ? timeline.voices.map((voice, index) => {
                    const source = cameraVoiceSourceStatus(
                      project, voice.clipId, missingSources, checked, !!error,
                    );
                    return <li key={`voice-${voice.clipId}`}>
                      {voice.category === "dialogue" ? "Dialogue" : "Narration"} start {index + 1}:
                      {" "}scene {cameraReviewTimecode(voice.start)}
                      {" "}· episode {cameraReviewTimecode(start + voice.start)}
                      {" "}· {voice.shotId ? "custom camera shot" : "default camera"}
                      {" "}· <span className="field-hint">{source.text}</span>
                      {" "}
                      <button type="button" className="button secondary small"
                        aria-label={`Inspect assigned voice ${index + 1} in scene ${item.sceneIndex + 1}`}
                        onClick={() => onScene(item.sceneIndex, "camera-review", voice.start,
                          source.soundReady ? "voice" : "voice-unavailable")}>
                        Inspect voice
                      </button>
                      {" "}
                      <button type="button" className="button secondary small"
                        aria-label={`Review assigned voice ${index + 1} in scene ${item.sceneIndex + 1} in Sound Studio`}
                        onClick={() => onScene(item.sceneIndex, "voices", undefined, undefined, voice.clipId)}>
                        Review this voice in Sound Studio
                      </button>
                    </li>;
                  }) : <li>No assigned audible dialogue or narration starts in this scene.</li>}
                </ul>
              </details>
              <button type="button" className="button secondary small"
                onClick={() => onScene(item.sceneIndex, "camera-review")}>
                Open scene {item.sceneIndex + 1} for camera review
              </button>
            </li>;
          })}
        </ol>
      </section>
      {!checked && <p role="status">Checking local audio originals…</p>}
      {error && <p role="alert">{error}</p>}
      {!!missing.length && (
        <p role="alert">
          Missing audio originals:{" "}
          {project.audioAssets
            .filter((a) => missing.includes(a.id))
            .map((a) => a.name)
            .join(", ")}
          . Restore a complete episode backup.
        </p>
      )}
      <div className="episode-scene-review">
        {rows.map((r) => (
          <div key={r.scene.id}>
            <strong>
              {r.index + 1}. {r.scene.title}
            </strong>
            <span>
              {r.scene.duration}s · {r.voice.length} voice clip(s) ·{" "}
              {r.captions} captions
            </span>
            <div className="voice-timing-map">
              <div className="voice-timing-strip"
                role="img"
                aria-label={`Voice timing strip for scene ${r.index + 1}: ${r.voiceCoverage.assignedSeconds.toFixed(1)} of ${r.voiceCoverage.totalSeconds.toFixed(1)} seconds have assigned dialogue or narration clip timing; other intervals are not necessarily silent`}>
                {voiceTimingBands(r.voiceCoverage).map((band, i) => (
                  <span key={i}
                    className={band.kind === "assigned" ? "voice-timing-assigned" : "voice-timing-unassigned"}
                    aria-hidden="true"
                    style={{ width: `${band.widthPercent}%` }}
                    title={`${band.kind === "assigned" ? "Assigned voice" : "No assigned voice"}: ${cameraReviewTimecode(band.start)}–${cameraReviewTimecode(band.end)}`}
                  />
                ))}
              </div>
              <div className="voice-timing-legend" aria-hidden="true">
                <span><i className="voice-timing-key-assigned" />Assigned voice clip timing</span>
                <span><i className="voice-timing-key-unassigned" />No voice clip assigned</span>
              </div>
            </div>
            <details aria-label={`Assigned voice coverage for scene ${r.index + 1}`}>
              <summary>
                Assigned voice coverage · {r.voiceCoverage.assignedSeconds.toFixed(1)}/{r.voiceCoverage.totalSeconds.toFixed(1)}s
                {" "}· {r.voiceCoverage.gaps.length} interval(s) without assigned voice
              </summary>
              <p className="field-hint">
                This shows only assigned, unmuted dialogue/narration clip timing.
                An unassigned interval is not necessarily silent (music or effects
                may play). An assignment does not prove recorded speech is audible,
                accurate or approved. Audio-source status reflects the original-file
                index on this device; available does not mean decoded or listened to.
                This review does not affect exports.
              </p>
              <ul aria-label={`Assigned voice intervals for scene ${r.index + 1}`}>
                {r.voiceCoverage.spans.map((clip, i) => {
                  const source = cameraVoiceSourceStatus(
                    project, clip.clipId, missingSources, checked, !!error,
                  );
                  return <li key={clip.clipId}>
                    Assigned {clip.category}: scene {cameraReviewTimecode(clip.start)}–{cameraReviewTimecode(clip.end)}
                    {" "}· episode {cameraReviewTimecode(r.start + clip.start)}–{cameraReviewTimecode(r.start + clip.end)}
                    {" "}· <span className="field-hint"
                      aria-label={`Audio source status for assigned ${clip.category} interval ${i + 1} in scene ${r.index + 1}`}>
                      {source.text}
                    </span>
                    {" "}
                    <button type="button" className="button secondary small"
                      aria-label={`Review assigned ${clip.category} interval ${i + 1} in scene ${r.index + 1} in Sound Studio`}
                      onClick={() => onScene(r.index, "voices", undefined, undefined, clip.clipId)}>
                      Review this recording
                    </button>
                  </li>;
                })}
                {r.voiceCoverage.spans.length === 0 && (
                  <li>No dialogue or narration clips assigned within this scene.</li>
                )}
                {r.voiceCoverage.gaps.map((gap, i) => (
                  <li key={`unassigned-${i}`}>
                    No assigned voice: scene {cameraReviewTimecode(gap.start)}–{cameraReviewTimecode(gap.end)}
                    {" "}· episode {cameraReviewTimecode(r.start + gap.start)}–{cameraReviewTimecode(r.start + gap.end)}
                    {" "}
                    <button type="button" className="button secondary small"
                      aria-label={`Open Sound Studio at unassigned voice interval ${i + 1} in scene ${r.index + 1}`}
                      onClick={() => onScene(r.index, "voices", gap.start)}>
                      Review or add voice here
                    </button>
                  </li>
                ))}
                {r.voiceCoverage.gaps.length === 0 && (
                  <li>Assigned voice clip timing covers this scene; listen to verify the content.</li>
                )}
              </ul>
            </details>
            {r.lineCount > 0 && <span>{checked ? `${r.approved}/${r.lineCount} script lines approved` : "Checking script recordings"}</span>}
            <span>
              {r.missing
                ? "Missing original — restore its episode package"
                : !r.voice.length
                  ? "No recorded voice assigned"
                  : checked
                    ? "Originals available · ready to review"
                    : "Checking originals"}
            </span>
            <button
              className="button secondary small"
              onClick={() => onScene(r.index, "voices")}
            >
              Record or review scene {r.index + 1}
            </button>
          </div>
        ))}
      </div>
    </details>
  );
}
