import { cameraMotionSamples } from "../camera-motion-samples";
import { cameraMotionArtworkChecks, cameraMotionArtworkSweep } from "../camera-motion-framing";
import type { CameraShot } from "../camera-shots";
import type { Project, Scene } from "../model";
import { sceneCaptionText } from "../production";
import { CaptionOverlay } from "./CaptionOverlay";
import { Stage } from "./Stage";

/** Purely opt-in preview. Real Stage and caption sampler are used at three
 * deterministic times; no frame export, playback or project writes occur. */
export function CameraMotionContactSheet({
  project, scene, shot, onInspectTime,
}: {
  project: Project; scene: Scene; shot: CameraShot;
  onInspectTime?: (time: number) => void;
}) {
  const samples = cameraMotionSamples(shot);
  const checks = cameraMotionArtworkChecks(project, scene, shot);
  const warnings = checks.filter(check => check.edges.length > 0);
  const sweep = cameraMotionArtworkSweep(project, scene, shot);
  return (
    <section className="camera-motion-contact-sheet"
      aria-label="Camera motion contact sheet">
      <h3>Camera motion: beginning, middle &amp; end</h3>
      <p>Check the real scene framing and captions at three points.
        These frames use the same stage timing as the genuine movie export.</p>
      <p role="status" className={warnings.length ? "camera-motion-edge-warning" : "camera-motion-edge-ok"}>
        {warnings.length
          ? "Artwork-edge check: " + warnings.length +
            " of 3 frames may show beyond the original artwork bounds. Review the marked frames."
          : "Artwork-edge check: no canvas edges exposed at the three sampled times."}
      </p>
      <div className="camera-motion-sweep" aria-label="Full camera move safety scan">
        <p className={sweep.flaggedCount ? "camera-motion-edge-warning" : "camera-motion-edge-ok"}
          aria-label="Full-move edge scan result">
          {sweep.flaggedCount
            ? "Full-move scan: " + sweep.flaggedCount + " of " + sweep.checks.length +
              " sampled moments may expose original canvas edges."
            : "Full-move scan: no canvas overrun found at " + sweep.checks.length +
              " sampled moments."}
        </p>
        {sweep.worst && <p>
          Worst sampled moment: {sweep.worst.time.toFixed(2)}s,
          approximately {(sweep.worst.outsideFraction * 100).toFixed(1)}%
          outside the original canvas
          ({sweep.worst.edges.join(", ")}).
        </p>}
        {sweep.worst && onInspectTime && (
          <button type="button" className="button secondary small"
            onClick={() => onInspectTime(sweep.worst!.time)}>
            Inspect worst sampled moment in preview
          </button>
        )}
      </div>
      <p className="field-hint">
        This is an advisory 800×450 canvas-boundary scan, not a pixel-level test.
        A custom background may extend beyond the canvas; inspect the actual pictures.
        The 21 samples cannot guarantee every in-between moment is safe.
      </p>
      <div className="camera-motion-frames">
        {samples.map(sample => (
          <figure key={sample.id} aria-label={sample.label + " frame"}>
            <figcaption>
              {sample.label}
              <small>{sample.time.toFixed(2)}s into the scene</small>
            </figcaption>
            <div className="live-stage">
              <Stage project={project} scene={scene} time={sample.time}
                labelled={false} />
              <CaptionOverlay text={sceneCaptionText(project, scene, sample.time)}
                style={project.captionStyle} />
            </div>
            {checks.find(check => check.id === sample.id)?.edges.length ? (
              <p className="camera-motion-edge-warning" aria-label={sample.label + " artwork edge warning"}>
                Check artwork edge: {checks.find(check => check.id === sample.id)?.edges.join(", ")}
              </p>
            ) : (
              <p className="camera-motion-edge-ok">Canvas edges covered</p>
            )}
          </figure>
        ))}
      </div>
    </section>
  );
}
