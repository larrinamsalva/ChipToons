# PR #92 — Exact Caption Changes During a Camera Hold

## Why
The five-point continuity guide (PR #91) checks timed caption text at
five actual Stage moments. A subtitle might appear and disappear
between adjacent checkpoints without ever being sampled.

This **Exact Caption Changes During Hold** navigator uses the
actual caption start/end boundaries that already exist in the
portable project. It does not guess times from five frames.

## Creator steps
1. Open **Direct My Cartoon Camera** for an existing camera move with
   a final hold, or add a reviewed original-PNG diagonal glide
   with 50%/75% pacing.
2. Preview the real shot, check **Show beginning, middle and end frames**,
   then expand **Review final-view hold frames**.
3. The new **Exact caption changes during hold** panel lists the
   actual subtitle changes (new text, disappearing text or overlaps)
   between the camera-settle moment and the last frame *inside*
   the shot. For longer scenes the first eight are printed and all
   changes remain available in the selector.
4. Choose **Jump to exact caption change** and select any listed
   cue to seek the live Stage/caption preview to its precise time.
   You can listen to the preview audio separately; timed text does
   not prove that the recorded voice matches the words.
5. Compare against any saved camera or explicitly Apply/Cancel.

## Boundaries, accessibility and preservation
- Captions starting at the exact moment the camera settles are part
  of the starting text. The navigator reports *subsequent* text
  changes during the hold, not a phantom transition at hold start.
- A caption ending at the exact shot end belongs to the next
  moment and is not shown inside the shot.
- Overlapping captions use the same joined text and ordering
  as the production renderer. Simultaneous start/end events
  are deduplicated. Changes that leave the rendered text
  identical are not counted.
- A clearly labeled, keyboard/touch-accessible selector works
  on phones, tablets and desktop. No account/login is needed.
- All data is read-only until ordinary Apply; no new animation,
  project schema, PNG edits, voice/audio changes, caption edits,
  exporter changes or automatic publishing.

Unit tests verify brief mid-hold captions missed by coarse sampling,
overlaps, simultaneous text, clears, scene separation, no hold and
no mutations. A browser integration test imports editable timed
captions and checks navigating to a real cue in the Stage preview.
Both required CI workflows must pass on the latest commit before
human merge.
