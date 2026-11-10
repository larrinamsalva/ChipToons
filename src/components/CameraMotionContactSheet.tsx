import { cameraMotionSamples } from "../camera-motion-samples";
import { cameraMotionArtworkChecks } from "../camera-motion-framing";
import type { CameraShot } from "../camera-shots";
import type { Project, Scene } from "../model";
import { sceneCaptionText } from "../production";
import { CaptionOverlay } from "./CaptionOverlay";
import { Stage } from "./Stage";

/** Purely opt-in preview. Real Stage and caption sampler are used at three
 * deterministic times; no frame export, playback or project writes occur. */
export function CameraMotionContactSheet({
  project, scene, shot,
}: {
  project: Project; scene: Scene; shot: CameraShot;
}) {
  const samples = cameraMotionSamples(shot);
  const checks = cameraMotionArtworkChecks(project, scene, shot);
  const warnings = checks.filter(check => check.edges.length > 0);
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
      <p className="field-hint">
        This is an advisory 800×450 canvas-boundary check, not a pixel-level test.
        A custom background may extend beyond that canvas; inspect the actual pictures.
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
