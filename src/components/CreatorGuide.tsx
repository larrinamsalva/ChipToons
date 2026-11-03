import { Modal } from "./Modal";
export type GuideStep =
  | "idea"
  | "art"
  | "scenes"
  | "animation"
  | "voice"
  | "music"
  | "preview"
  | "export";
const STEPS: [GuideStep, string, string, string][] = [
  [
    "idea",
    "Start with a story idea",
    "Choose Start with a Thought. Describe a friend feeling left out, choose Pip and Sunny, a park, and kindness. Press Find my story, review the scene outline, then Create my storyboard.",
    "Plan a new thought",
  ],
  [
    "art",
    "Add or draw a character",
    "Open Art library. Create a character, upload an image, or choose Draw artwork. Save it to your collection, then Add to scene. A single uploaded image moves as one piece.",
    "Open art library",
  ],
  [
    "scenes",
    "Build storyboard scenes",
    "Use Story chapters for an overview. Prepare scene notes, edit the batch and Add reviewed scenes. In Scene details, edit narration, dialogue, learning question and duration.",
    "Open story chapters",
  ],
  [
    "animation",
    "Choose an animation",
    "In the animation timeline, select Pip or Sunny, choose an Action, Preview action and Apply action. Edit keyframe time and position numerically, or use the arrow controls.",
    "Find animation tools",
  ],
  [
    "voice",
    "Record speech",
    "Open Voices & Sound. Select the scene and narration or dialogue. Press Start microphone recording, speak, then Stop recording. Listen to the preview and choose Save audio clip. Microphone permission is only requested when recording. For a fully narrated longer story, press Enable long-episode audio first.",
    "Open voice recording",
  ],
  [
    "music",
    "Add background sound",
    "In Voices & Sound, open Original music & sound effects and press Kindness melody or another sound button. Select the clip to set its start, fades and volume. Use Cartoon mixer to lower music or enable ducking under recorded voices.",
    "Open sound tools",
  ],
  [
    "preview",
    "Watch and listen",
    "Press Play cartoon with Sound on. Use Preview scope to watch one scene or the full episode. Pause to edit. Browser voice preview is separate from recorded movie audio.",
    "Go to preview",
  ],
  [
    "export",
    "Export and keep a backup",
    "Open Finish My Cartoon, review the checklist, then Export complete cartoon or export numbered whole-scene parts. Download every ready movie part. Project backup saves editable artwork, animation, recordings and captions.",
    "Open Finish My Cartoon",
  ],
];
export function CreatorGuide({
  onClose,
  onStep,
  inEditor = false,
}: {
  onClose: () => void;
  onStep: (step: GuideStep) => void;
  inEditor?: boolean;
}) {
  return (
    <Modal title="Make your first friendship cartoon" onClose={onClose} wide>
      <p className="section-description">
        Follow Pip and Sunny’s original “A little room for a friend” example,
        then make every detail your own.
      </p>
      <ol className="creator-guide">
        {STEPS.map(([id, title, text, action], i) => (
          <li key={id}>
            <span className="step-number">{i + 1}</span>
            <div>
              <h3>{title}</h3>
              <p>{text}</p>
              {(inEditor ? id !== "idea" : id === "idea") && (
                <button
                  className="button secondary small"
                  onClick={() => onStep(id)}
                >
                  {action}
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
      <details className="backup-tutorial">
        <summary>Save, backup and restore: a quick practice</summary>
        <ol>
          <li>
            Wait for “Saved on this device” after editing. Save failed means the
            changes are still on screen: download a backup before leaving.
          </li>
          <li>
            Press Project backup and keep the JSON or complete .ctepisode file
            somewhere you can find it. Movie downloads cannot restore editable
            scenes.
          </li>
          <li>
            On My cartoons, choose Restore a backup and select that backup file.
            It opens as a separate project, preserving your existing story.
          </li>
          <li>
            Exported movie parts stay in your browser’s Downloads. After an
            interrupted export, reopen Finish My Cartoon and retry just the
            needed scene range. Completed files do not need re-exporting.
          </li>
        </ol>
      </details>
      <p className="local-note">
        No login. Microphone recordings and ideas stay local. Keep backups
        before clearing browser data or changing devices.
      </p>
      <div className="modal-actions">
        <button className="button primary" onClick={onClose}>
          Back to creating
        </button>
      </div>
    </Modal>
  );
}
