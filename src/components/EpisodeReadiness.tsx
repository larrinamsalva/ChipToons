import { useEffect, useState } from "react";
import type { Project } from "../model";
import { missingAudio } from "../audio-vault";
import { clipStart } from "../production";
import { sceneStart } from "../timeline";
export function EpisodeReadiness({
  project,
  onReady,
  onScene,
}: {
  project: Project;
  onReady: (ready: boolean) => void;
  onScene: (index: number, panel?: "voices" | "captions") => void;
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
