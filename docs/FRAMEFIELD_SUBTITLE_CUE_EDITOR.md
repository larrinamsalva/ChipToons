# PR #67 — Subtitle Cue Editor (Two-Part Timing Drafts)

ChipToons' original written subtitle preview and downloadable .srt file
(PR #66) use one subtitle per scene. This step lets creators prepare
shorter captions with a single adjustable split inside an existing shot.

## Workflow

1. Choose a multi-shot cartoon and original numbered local PNGs.
2. Write narration in the Story Beat field, if desired.
3. Under a scene's **Subtitle cue review**, choose **Customize subtitles**.
   The first field starts from that scene's original written narration.
4. Enter an optional second subtitle to split the shot into two cues.
   Slide the **Second subtitle timing** control between 20–80% in 5%
   steps to choose the scene-relative split time.
5. Play or seek the original PNG reel to review the caption changes.
   Download the real .srt file with the exact scene order, holds and
   split times. Up to two cues are produced per shot.
6. Choose **Use original narration** to restore an unsplit default cue.
   Written narration itself stays unchanged and editable.

## Preservation, boundaries and testing

- Local pre-import subtitles only; they never mutate original PNGs,
  existing cartoons, narration, saved project caption tracks, portable
  backup structure, audio, scene timings or real WebM exports.
- The split is a manually selected percentage, not speech detection or
  genuine audio synchronization. Please review and adjust the finished
  subtitles against actual narration before publishing.
- The override is linked to the exact original shot prefix across
  reorders and holds. New selections or switching import mode erase
  these unsaved overrides.
- Each text is limited to 300 characters, the percent is an integer
  between 20 and 80 in steps of five, and malformed/stale overrides
  are rejected. Empty captions are omitted, never exported as blank cues.
- Unit tests verify real SubRip millisecond timestamps, original
  default behavior, split boundaries, blank captions and rejection
  of stale or invalid overrides.
- Desktop, phone and tablet browser tests verify source PNG order,
  actual downloaded .srt contents, independent scene narration,
  keyboard slider operation, reset, and file-selection cleanup.
- Both Foundation/browser QA and complete genuine 20-minute narrated
  movie export must pass on the latest PR SHA before manual merge.
  Do not automatically merge, deploy or publish.
