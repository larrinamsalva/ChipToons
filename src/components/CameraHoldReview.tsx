import { cameraHoldReviewTimes } from "../camera-motion-scrub";
import type { CameraShot } from "../camera-shots";
import type { Project, Scene } from "../model";
import { sceneCaptionText } from "../production";
import { CaptionOverlay } from "./CaptionOverlay";
import { Stage } from "./Stage";

/** Read-only true Stage snapshots of camera hold. PNG animations may still
 * change between snapshots; this only compares where the camera points. */
export function CameraHoldReview({project,scene,shot,onInspectTime}:{
  project:Project; scene:Scene; shot:CameraShot;
  onInspectTime?: (time:number)=>void;
}){
  const hold=cameraHoldReviewTimes(shot);
  if(!hold)return null;
  const moments=[
    {id:"finish",label:"Camera settles",time:hold.finishTime},
    {id:"last",label:"Near shot end",time:hold.lastTime},
  ];
  const firstCaption=sceneCaptionText(project,scene,hold.finishTime);
  const lastCaption=sceneCaptionText(project,scene,hold.lastTime);
  return (
    <details role="group" className="camera-hold-review" aria-label="Camera hold frame review">
      <summary>Review final-view hold frames ({hold.holdSeconds.toFixed(2)}s)</summary>
      <p className="field-hint">
        Compare two actual Stage frames: when camera movement ends and near the
        end of the same shot. The camera should hold steady, but original PNG
        animation and timed captions may continue to change.
      </p>
      <div className="camera-hold-frames">
        {moments.map(moment=>(
          <figure key={moment.id} aria-label={moment.label+" frame"}>
            <figcaption>{moment.label}
              <small>{moment.time.toFixed(2)}s into scene</small>
            </figcaption>
            <div className="live-stage">
              <Stage project={project} scene={scene} time={moment.time} labelled={false}/>
              <CaptionOverlay text={sceneCaptionText(project,scene,moment.time)}
                style={project.captionStyle}/>
            </div>
            {onInspectTime && <button type="button" className="button secondary small"
              onClick={()=>onInspectTime(moment.time)}>
              Inspect {moment.label.toLowerCase()} in preview
            </button>}
          </figure>
        ))}
      </div>
      <p className="field-hint">
        {firstCaption===lastCaption
          ? "The displayed caption is the same at both sampled moments."
          : "The displayed caption changes during this camera hold."}
        {" "}This is a visual inspection aid, not a claim that artwork or
        characters stop animating.
      </p>
    </details>
  );
}
