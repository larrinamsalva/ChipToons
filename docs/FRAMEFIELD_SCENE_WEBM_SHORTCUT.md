# PR #75 — Export a Single Imported Cartoon Scene as a Real WebM

## Creator workflow

In an imported numbered-PNG cartoon, open **Finish My Cartoon →
Guided Voice Recording**, select a scene, and choose **Prepare a real
WebM clip for this scene**. Alternatively, use **Prepare WebM clip for
scene N** under Caption & Voice Timing Review.

The shortcut scrolls to the existing **Scene segment exports** area,
expands **Choose a different whole-scene range**, and preselects that
one scene as both First scene and Last scene. It **does not render
automatically**. Review the selected duration, video format,
resolution, frame rate and the existing mixed-audio/caption options,
then press **Export selected scene range** when ready.

The existing fully verified local export pipeline uses actual authored
frame-sequence animation, local voice/music/effects audio mixing and
timed captions. After rendering, it exposes the standard genuine WebM
preview and download. Clips are limited to one complete scene and
the device/browser's documented export limit (60 or 120 seconds).

## Integrity and safety

- No new or duplicated exporter. The shortcut selects a range for
  the existing SegmentExports component and exportVideo pipeline.
- No export starts just by opening a scene or using the shortcut.
- A newly selected scene updates both range endpoints, including
  selecting the same scene again after closing the details.
- Existing range selection, multi-part exports, verified episode
  export, portable backups, local storage, source originals, captions
  and the creator's work remain unchanged.
- The shortcut is available only in the imported PNG cartoon review.
  Other projects retain their normal full and segmented exporters.
- Browser support and export/readiness rules remain in force, and the
  user remains responsible for reviewing recorded voices and captions
  before publishing. MP4 is not added by this feature.

## Merge gates

Desktop/phone/tablet browser QA selects an imported numbered-PNG scene,
jumps to the verified exporter, checks exact range endpoints, and
returns to another scene. Existing tests validate genuine self-contained
WebM scene-range and long-episode exports. Foundation QA plus the full
20-minute narrated export checks must pass on the latest PR commit.
Human reviews before merging; no automatic merge, release or publish.
