import { cameraMotionSamples } from "../camera-motion-samples";
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
  return (
    <section className="camera-motion-contact-sheet"
      aria-label="Camera motion contact sheet">
      <h3>Camera motion: beginning, middle &amp; end</h3>
      <p>Check the real scene framing and captions at three points.
        These frames use the same stage timing as the genuine movie export.</p>
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
          </figure>
        ))}
      </div>
    </section>
  );
}
