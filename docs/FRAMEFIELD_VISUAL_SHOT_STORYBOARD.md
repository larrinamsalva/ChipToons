# PR #60 — Visual Framefield Shot Storyboard

PR #59 introduced Shot Director ordering and end-of-shot holds. This
increment adds **real original PNG previews** so creators can see the
source artwork before they build the cartoon.

## How to use

1. Expand **More ways to create · 3D, art, film & XR studio connections**
   on the ChipToons dashboard and choose original local, consecutively
   numbered PNG files.
2. **Single shot:** a preview appears underneath the file controls.
   **Multiple shots:** each Shot Director row shows a preview for its
   own numbered PNG sequence, even when you manually move the shot
   earlier or later.
3. Use **Inspect numbered frame** slider or **Previous frame / Next
   frame** buttons to see *the actual selected source image*, one frame
   at a time. Labels include the filename, frame number and its local
   time at the selected 2/4/8/12 fps playback speed.
4. Set the Shot Director order and optional 0–3-second final-frame
   hold as before, then **Create multi-shot cartoon**. Previews do not
   save or modify any project and are not added to the output.
5. The resulting cartoon still relies on the exact original frame
   IDs, scene clock, and genuine WebM recorder from PRs #57–#59.

## Explicit scope

- This is **local-only, static inspection**, not automatic playback,
  motion interpolation, a new video format, 3D mesh editing or
  animation rig retargeting. The original PNG files are displayed
  without scaling their underlying saved pixels.
- Up to three shot previews may be shown at a time, each displaying
  **only one frame**; the old preview's temporary browser object URL
  is revoked when the selected frame changes or the preview closes.
  File changes and switching between one-shot/multi-shot modes reset
  preview selection. Reordering rows keeps each shot's inspected frame.
- The controls are keyboard-operable and retain dark/light high-contrast
  labels, descriptive image alternate text and a readable time/filename.
- Existing project schema, backups, saved scenes, 2D/2.5D puppet
  animations, 20-minute genuine episode export, single/multi-shot
  importing, original file limits and failure behavior stay untouched.
- A broken or undecodable PNG displays an error in the preview. The
  existing importer independently verifies the actual PNG signatures
  and browser decodability before creating any new project.

## Tests and merge gates

`tests/framefield-visual-storyboard.spec.ts` checks real browser PNG
thumbnail decoding, frame-by-frame scrubbing, image changes, revoke of
unused object URLs, keeping preview positions with manually reordered
Shot Director rows, and rejecting incomplete source selections.

**Do not merge this draft until the latest Foundation/browser QA and
the full 20-minute narrated episode/genuine-export checks are green.**

## PR #61 — Watch a complete original-PNG storyboard before importing

The **Play full storyboard** panel plays the selected original local PNG images in the current Shot Director order, with timed scene cuts and real final-frame holds. It has Play/Pause/Restart and a keyboard-accessible seek slider; it does **not** create or record a movie. See [Playable Story Reel](FRAMEFIELD_PLAYABLE_STORY_REEL.md).
