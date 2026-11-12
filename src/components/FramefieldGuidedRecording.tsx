import { useState } from "react";
import type { Project } from "../model";
import { framefieldGuidedSession } from "../framefield-guided-session";
import { framefieldSceneVoiceSources } from "../framefield-voice-listenback";
import { OriginalAudio } from "./VoiceStudio";
import { canStartFramefieldCinematicPush } from "../framefield-cinematic-push";
import {
  framefieldSceneReviewCounts, nextFramefieldSceneToReview,
} from "../framefield-scene-review-navigation";
import type { SceneReviewKind } from "../framefield-scene-review-navigation";

/** A read-only rehearsal guide; actual recording remains in VoiceStudio. */
export function FramefieldGuidedRecording({
  project, onScene, onExportScene,
}: {
  project: Project;
  onScene: (index: number, panel?: "voices" | "captions" | "preview" | "camera" | "camera-pan" | "camera-tilt" | "camera-glide" | "camera-reveal") => void;
  onExportScene: (index: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState(0);
  const [selectedClipId, setSelectedClipId] = useState("");
  const session = framefieldGuidedSession(project);
  const position = Math.max(0, Math.min(selected, session.scenes.length - 1));
  const reviewCounts = framefieldSceneReviewCounts(session.scenes);
  function jumpToReview(kind: SceneReviewKind) {
    const next = nextFramefieldSceneToReview(session.scenes, position, kind);
    if (next !== undefined) {
      setSelected(next);
      setSelectedClipId("");
    }
  }
  const scene = session.scenes[position];
  const sources = framefieldSceneVoiceSources(project, position);
  const preview = sources.find(source => source.clip.id === selectedClipId)
    ?? sources[0];
  return (
    <section aria-label="Guided scene voice recording">
      <h3>Guided Voice Recording</h3>
      <p className="field-hint">
        Rehearse your actual scenes in order. The existing Voices &amp; Sound
        Studio handles all microphone permissions, recording, preview and saving.
      </p>
      <button type="button" className="button secondary"
        onClick={() => setExpanded(open => !open)}>
        {expanded ? "Close guided recording" : "Start guided voice recording"}
      </button>
      {expanded && scene && (
        <div role="group" aria-label="Current guided recording step">
          <p role="status">
            {"Scene " + (position + 1) + " of " + session.scenes.length +
              " · " + session.scenesWithAssignedVoice +
              " scene(s) with assigned voice intervals"}
          </p>
          <div className="framefield-scene-work-queue"
            role="group" aria-label="Storyboard production navigator">
            <h4>Jump to a scene that needs review</h4>
            <label>
              Jump to storyboard scene
              <select aria-label="Jump to storyboard scene"
                value={position}
                onChange={event => {
                  setSelected(Number(event.target.value));
                  setSelectedClipId("");
                }}>
                {session.scenes.map((entry,index)=>(
                  <option value={index} key={entry.sceneId}>
                    Scene {index+1} · {entry.title}
                  </option>
                ))}
              </select>
            </label>
            <p className="field-hint">
              {reviewCounts.voice} scene(s) with written words but no assigned
              audible voice · {reviewCounts.captions} scene(s) without timed
              captions · {reviewCounts.timing} scene(s) with caption/voice
              interval gaps.
            </p>
            <div className="animation-actions">
              <button type="button" className="button secondary small"
                disabled={!reviewCounts.voice}
                onClick={()=>jumpToReview("voice")}>
                Next scene without assigned voice
              </button>
              <button type="button" className="button secondary small"
                disabled={!reviewCounts.captions}
                onClick={()=>jumpToReview("captions")}>
                Next scene without timed captions
              </button>
              <button type="button" className="button secondary small"
                disabled={!reviewCounts.timing}
                onClick={()=>jumpToReview("timing")}>
                Next scene with caption timing gaps
              </button>
            </div>
            <p className="field-hint">
              These are only written-text and clip-timing hints. Silent scenes
              may be intentional. Listen to the real recording to confirm
              spoken words and synchronization; navigation never saves,
              records, edits or approves a scene.
            </p>
          </div>
          <h4>{scene.title}</h4>
          <p>{"Episode time: " + scene.episodeStart.toFixed(2) +
            "s–" + scene.episodeEnd.toFixed(2) + "s"}</p>
          {scene.narration.trim()
            ? <p><strong>Read narration:</strong> {scene.narration}</p>
            : <p className="field-hint">No written narration for this scene.</p>}
          {scene.dialogue.trim() && (
            <p><strong>Read dialogue:</strong> {scene.dialogue}</p>
          )}
          <p className={scene.missingVoice ? "framefield-voice-warning" : "field-hint"}>
            {scene.missingVoice
              ? "Written words need a real voice assignment or may remain intentionally silent."
              : scene.voiceClips > 0
                ? "Assigned voice intervals exist; listen to verify real spoken words."
                : "No assigned voice interval. A silent scene is allowed."}
          </p>
          {scene.cues.length ? (
            <ul aria-label="Caption cues for current recording scene">
              {scene.cues.map(cue => (
                <li key={cue.id}>
                  <strong>{cue.episodeStart.toFixed(2) + "s–" +
                    cue.episodeEnd.toFixed(2) + "s: "}</strong>
                  {cue.text}
                  {" · " + (cue.overlapsVoice
                    ? "An assigned voice clip overlaps; listen to confirm"
                    : "No assigned voice clip overlaps")}
                  {" · " + Math.round(cue.coverageFraction * 100) +
                    "% of cue interval overlaps assigned voice"}
                  {cue.uncovered.length > 0 && (
                    <span>{" · Uncovered: " + cue.uncovered.map(gap =>
                      (scene.episodeStart + gap.start).toFixed(2) + "–" +
                      (scene.episodeStart + gap.end).toFixed(2) + "s"
                    ).join(", ")}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : <p className="field-hint">No timed captions for this scene.</p>}
          <section aria-label="Recorded scene voice listen-back">
            <h4>Listen back to assigned voice sources</h4>
            <p className="field-hint">
              Play a saved original audio source using its own controls. The
              original is untrimmed; scene timing, fades, volume, mute and
              soundtrack mixing are not applied. Preview the complete cartoon
              to verify final sync. An assigned source may not contain speech.
            </p>
            {sources.length === 0 ? (
              <p className="field-hint">
                No narration or dialogue clips overlap this scene yet.
                Use the existing studio to record or upload a take.
              </p>
            ) : (
              <div>
                <label>
                  Assigned voice source to listen to
                  <select aria-label="Assigned voice source to listen to"
                    value={preview?.clip.id ?? ""}
                    onChange={event => setSelectedClipId(event.target.value)}>
                    {sources.map(source => (
                      <option key={source.clip.id} value={source.clip.id}>
                        {source.clip.name + " · " + source.clip.category +
                          " · " + source.episodeStart.toFixed(2) + "s"}
                      </option>
                    ))}
                  </select>
                </label>
                {preview && (
                  <div key={preview.clip.id} role="group"
                    aria-label="Selected assigned voice source">
                    <p className="field-hint">
                      {"Assigned clip: " + preview.episodeStart.toFixed(2) +
                        "s–" + preview.episodeEnd.toFixed(2) +
                        "s · Source trim: " + preview.clip.trimStart.toFixed(2) +
                        "s–" + preview.clip.trimEnd.toFixed(2) + "s"}
                    </p>
                    {!preview.audibleInMix && (
                      <p className="framefield-voice-warning">
                        This clip is muted or has zero clip, voice or master
                        volume. Its original source may still play here.
                      </p>
                    )}
                    {preview.asset ? (
                      <OriginalAudio asset={preview.asset} />
                    ) : (
                      <p role="alert">
                        Missing audio source metadata. Open Voices &amp; Sound
                        to repair this clip.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
          <div className="animation-actions">
            <button type="button" className="button secondary"
              onClick={() => onScene(position, "preview")}>
              Open this scene with picture and mixed sound
            </button>
            {canStartFramefieldCinematicPush(project, project.scenes[position]) && (
              <>
                <button type="button" className="button secondary"
                  onClick={() => onScene(position, "camera")}>
                  Give this scene a gentle cinematic push-in
                </button>
                <button type="button" className="button secondary"
                  onClick={() => onScene(position, "camera-pan")}>
                  Try a gentle cinematic side-pan
                </button>
                <button type="button" className="button secondary"
                  onClick={() => onScene(position, "camera-tilt")}>
                  Try a gentle cinematic vertical tilt
                </button>
                <button type="button" className="button secondary"
                  onClick={() => onScene(position, "camera-glide")}>
                  Try a gentle diagonal cinematic glide
                </button>
                <button type="button" className="button secondary"
                  onClick={() => onScene(position, "camera-reveal")}>
                  Try a cinematic pull-back reveal
                </button>
              </>
            )}
            <button type="button" className="button secondary"
              onClick={() => onExportScene(position)}>
              Prepare a real WebM clip for this scene
            </button>
            <button type="button" className="button primary"
              onClick={() => onScene(position, "voices")}>
              Record or upload this scene
            </button>
            <button type="button" className="button secondary"
              onClick={() => onScene(position, "captions")}>
              Review this scene's captions
            </button>
          </div>
          <div role="group" aria-label="Recording scene navigation"
            className="animation-actions">
            <button type="button" className="button secondary small"
              disabled={position === 0}
              onClick={() => {
                setSelected(i => Math.max(0, i - 1));
                setSelectedClipId("");
              }}>
              Previous scene
            </button>
            <button type="button" className="button secondary small"
              disabled={position >= session.scenes.length - 1}
              onClick={() => {
                setSelected(i => Math.min(session.scenes.length - 1, i + 1));
                setSelectedClipId("");
              }}>
              Next scene
            </button>
          </div>
          <p className="field-hint">
            Open this scene to inspect the real moving images and the mixed
            soundtrack, then press Play cartoon. On an original PNG shot
            without existing camera work, choose a gentle cinematic push-in:
            preview it in the normal Camera Director and approve Apply
            before it changes your movie. Or try a sideways camera move
            with a little zoom, choosing left or right in that same editor.
            The pull-back option begins closer and reveals the full picture
            after you explicitly preview and Apply. You can also jump to the
            existing scene-range exporter, where the selected scene is
            prefilled; rendering starts only after you press Export selected
            scene range. The editor selects this scene,
            turns Sound on and sets Preview scope to Selected scene; no audio
            begins until you press Play. Return to Finish My Cartoon after
            recording to inspect updated voice coverage. This guide never
            approves speech, changes a project or saves its current step.
          </p>
        </div>
      )}
    </section>
  );
}
