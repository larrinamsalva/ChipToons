# PR #76 — Optional Cinematic Push-In for Imported PNG Cartoons

## An actual moving-camera effect, not a pretend preview

Imported original PNG shots can now opt into a gentle camera push-in
using ChipToons' existing **Direct My Cartoon Camera** editor. A shot
starts at a 1× wide view and eases to 1.35× zoom across the selected
scene. The actual PNG sequence, story timing, captions and real
soundtrack are unchanged. The existing animated stage engine generates
the movement in both live preview and the real WebM video export.

## Creator workflow

Open **Finish My Cartoon → Guided Voice Recording** and choose a scene
that has no previous camera shots or authored camera track. Select
**Give this scene a gentle cinematic push-in**. The full Camera
Director opens with a safe, centered gentle-move draft.

Press **Preview Shot** or **Preview Full Sequence** to inspect the
real animated camera and caption layout. Then explicitly press
**Apply** to save the move, or **Cancel** to preserve the original
wide shot. Existing projects and frames never change without Apply.

An equivalent **Create gentle camera move for scene N** action appears
beside each eligible imported PNG scene in Caption & Voice Timing Review.
Once a shot has camera work, the preset shortcuts disappear. Existing
camera tools can still edit or remove the shot in the regular studio.

## Accuracy, compatibility and preservation

- The optional preset is limited to original numbered-PNG imported
  scenes with wide camera framing and no existing camera animation or
  shot list. This avoids overwriting creator-authored camera work.
- The preset uses the existing validated CameraShot model and
  ScenePlayer/Stage/exportVideo pipeline; it adds no new schema,
  renderer, external service or default automatic movement.
- The only new data after explicit Apply is a normal editable
  camera shot, which remains portable and undoable.
- For a typical two-second shot, the complete move lasts two seconds.
  Long shots move more slowly, over their actual scene duration.
- Zooming intentionally crops toward the center; creators should
  preview faces, text, captions and edges before approving.
- Browser QA checks real original-PNG import, initial preview,
  explicit Apply and preserved frame IDs. Pure tests verify
  project validation, the beginning/middle/end zoom path,
  no mutation before Apply and protection of existing camera tracks.
- All Foundation and 20-minute genuine WebM/audio video export gates
  must pass on the latest PR commit before human manual merge.
