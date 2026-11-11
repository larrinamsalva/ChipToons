# PR #90 — Two-Frame Camera Hold Review

## Purpose
PR #89 marked the exact point where a camera move finishes and
starts holding its final framing. Now animators can inspect two true
Stage pictures to judge how the scene looks while the camera is still.

## Creator steps
1. In **Direct My Cartoon Camera**, choose a move that finishes before
   the shot ends, such as an imported-PNG diagonal glide with
   **Finish at 75%, then hold**.
2. Press **Preview Shot** or **Preview Full Sequence** and turn on
   **Show beginning, middle and end frames**.
3. Expand **Review final-view hold frames** (collapsed by default).
   This shows two real, captioned Stage samples: when camera motion
   finishes and near (but strictly inside) the end of the shot.
4. Inspect the actual rendered PNG artwork and timed captions.
   The camera is steady, but frames and characters may animate,
   and words/captions may change during the hold.
5. Press the frame's **Inspect ... in preview** button to seek the
   existing live Stage player to that exact moment. Use
   **Compare with the saved camera** to see only real saved-camera
   hold frames, not a misleading draft when none is saved.
6. Explicit **Apply** or **Cancel**. A visual inspection never saves.

## Preservation and scope
This is strictly an optional two-frame preview of existing Stage
and CaptionOverlay content. It does not alter the camera timeline,
source PNG frames, puppets, recorded voices, caption timing, saved
backups or genuine WebM rendering/export. It samples real Stage
content rather than synthesizing new images.

The hold review appears only when a move has a meaningful held
portion; full-scene moves show no hold review. It also honors
half-open shot ends to avoid accidentally showing the next shot.

Pure tests check settle/start/end timing, half-open boundaries,
no-hold cases, real Stage framing and source preservation.
Desktop/phone/tablet browser checks use the actual Expressive
down-right imported-PNG hold example, expand two frames, inspect
actual zoom and seek, then verify saved-vs-proposed comparison.
Both Foundation and narrated 20-minute genuine WebM gates must
pass on the latest head before manual merge.
