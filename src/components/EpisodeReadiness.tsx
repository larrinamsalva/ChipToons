import { useEffect, useState } from "react";
import type { Project } from "../model";
import { missingAudio } from "../audio-vault";
import { clipStart } from "../production";
import { episodeCameraSummary } from "../episode-camera-review";
import { episodeCameraPunchList, cameraReviewTimecode } from "../episode-camera-punch-list";
import { cameraCoverageReview } from "../camera-coverage-review";
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
  onScene: (index: number, panel?: "voices" | "captions" | "camera-review") => void;
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
      voice,
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
              new Blob([episodeCameraPunchList(project)], {
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
                    </li>
                  )) : <li>No default-camera intervals in this scene.</li>}
                  {timeline.voices.length ? timeline.voices.map((voice, index) => (
                    <li key={`voice-${voice.clipId}`}>
                      {voice.category === "dialogue" ? "Dialogue" : "Narration"} start {index + 1}:
                      {" "}scene {cameraReviewTimecode(voice.start)}
                      {" "}· episode {cameraReviewTimecode(start + voice.start)}
                      {" "}· {voice.shotId ? "custom camera shot" : "default camera"}
                    </li>
                  )) : <li>No assigned audible dialogue or narration starts in this scene.</li>}
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
