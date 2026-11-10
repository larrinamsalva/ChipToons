import type { Project } from "../model";
import { framefieldCaptionVoiceReview } from "../framefield-caption-voice-review";
import { framefieldRecordingPunchList } from "../framefield-recording-punch-list";
import { FramefieldGuidedRecording } from "./FramefieldGuidedRecording";
import { downloadBlob, safeFilename } from "../files";

/** Explicitly scoped to cartoons created from the local multi-shot bridge. */
export function FramefieldCaptionVoiceReview({
  project, onScene,
}: {
  project: Project;
  onScene: (index: number, panel?: "voices" | "captions" | "preview") => void;
}) {
  const review = framefieldCaptionVoiceReview(project);
  return (
    <section className="framefield-caption-voice-review"
      aria-label="Storyboard caption and voice timing review">
      <h3>Caption &amp; Voice Timing Review</h3>
      <p className="field-hint">
        Check where written captions and actual assigned voice-clip time ranges
        overlap. This does not listen to recordings or verify spoken words.
        Even overlapping clips must be played and checked by a person.
      </p>
      <FramefieldGuidedRecording project={project} onScene={onScene} />
      <div className="animation-actions">
        <button type="button" className="button secondary"
          onClick={() => downloadBlob(
            new Blob([framefieldRecordingPunchList(project)], {
              type: "text/plain;charset=utf-8",
            }),
            `${safeFilename(project.title)}-recording-checklist.txt`,
          )}>
          Download recording to-do sheet (.txt)
        </button>
      </div>
      <p className="field-hint">
        Save the current scene-by-scene written checklist with caption times,
        words, and outstanding recording reviews. No audio is generated or uploaded.
      </p>
      <p className="framefield-voice-summary">
        {review.scenesWithAssignedVoice}/{review.scenes.length} scenes with an assigned
        audible voice clip · {review.captions} timed captions ·
        {" "}{review.captionsWithoutOverlappingVoice} captions with no overlapping voice clip
      </p>
      <ol aria-label="Storyboard scene audio and caption review">
        {review.scenes.map(scene => (
          <li key={scene.sceneId}>
            <strong>Scene {scene.sceneIndex + 1} · {scene.title}</strong>
            <p className="field-hint">
              {scene.duration.toFixed(2)} seconds · {scene.voiceClips} assigned
              audible voice clip(s) · {scene.captions} caption(s)
            </p>
            {scene.missingVoice && (
              <p className="framefield-voice-warning">
                Written narration has no assigned audible voice clip in this scene.
                It will remain written text unless you record or assign speech.
              </p>
            )}
            {scene.missingCaptions && (
              <p className="framefield-voice-warning">
                No timed captions in this scene. Add captions if these words
                should appear during the finished cartoon.
              </p>
            )}
            {!!scene.unmatchedCues && (
              <p className="framefield-voice-warning">
                {scene.unmatchedCues} caption(s) have no overlapping assigned
                voice clip. Review whether these are deliberately silent text.
              </p>
            )}
            {!!scene.partiallyCoveredCues && (
              <p className="framefield-voice-warning">
                {scene.partiallyCoveredCues} caption(s) overlap assigned voice
                intervals for only part of their duration. Inspect the
                uncovered time below and listen to the actual recording.
              </p>
            )}
            {!scene.missingVoice && !scene.missingCaptions &&
              scene.unmatchedCues === 0 &&
              scene.partiallyCoveredCues === 0 && (
                <p className="field-hint">
                  No timing-coverage gaps detected. Listen and verify the actual
                  words and synchronization before publishing.
                </p>
              )}
            {!!scene.cues.length && (
              <ul aria-label={`Caption cue coverage for scene ${scene.sceneIndex + 1}`}>
                {scene.cues.map(cue => (
                  <li key={cue.id}>
                    <span>{cue.start.toFixed(2)}–{cue.end.toFixed(2)}s · </span>
                    <span>{cue.text}</span>
                    <span> · {cue.overlapsVoice
                      ? "Voice clip overlaps; listen to confirm"
                      : "No assigned voice overlaps"}</span>
                    <span>{" · " + Math.round(cue.coverageFraction * 100) +
                      "% of cue interval overlaps voice"}</span>
                    {cue.uncovered.length > 0 && (
                      <span>{" · Uncovered: " + cue.uncovered.map(gap =>
                        gap.start.toFixed(2) + "–" + gap.end.toFixed(2) + "s"
                      ).join(", ")}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="animation-actions">
              <button type="button" className="button secondary small"
                onClick={() => onScene(scene.sceneIndex, "preview")}>
                Preview scene {scene.sceneIndex + 1} with mixed sound
              </button>
              <button type="button" className="button secondary small"
                onClick={() => onScene(scene.sceneIndex, "voices")}>
                Review voices for scene {scene.sceneIndex + 1}
              </button>
              <button type="button" className="button secondary small"
                onClick={() => onScene(scene.sceneIndex, "captions")}>
                Review captions for scene {scene.sceneIndex + 1}
              </button>
            </div>
          </li>
        ))}
      </ol>
      <p className="field-hint">
        These suggestions never block export, rewrite subtitles, synthesize
        speech or change your saved project. Intentionally silent cartoons
        are allowed.
      </p>
    </section>
  );
}
