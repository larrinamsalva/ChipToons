# PR #89 — Live Camera Move Finish & Hold Timing Guide

## Purpose
After the diagonal glide pacing choices (PR #88), creators need
to see exactly when the motion reaches its final view while previewing.
This is the real animation timing, not an estimated scene preview.

## Creator workflow
1. Open **Direct My Cartoon Camera** and edit an existing camera move,
   or choose an imported-PNG diagonal glide with its direction, intensity
   and pacing options.
2. Click **Preview Shot** or **Preview Full Sequence**.
3. The normal camera scrubber displays a **camera finish marker**, its
   precise scene time and (where applicable) how long the final view
   stays still until the shot ends.
4. Use **Jump to camera move finish** to seek the genuine Stage preview
   and see the exact held composition and timed caption.
5. **Compare with the saved camera** switches the marker to a saved
   camera move if one exists; it never mistakenly describes the
   proposed draft when comparing with an unchanged original.
6. Review and explicitly **Apply** or **Cancel**. A jump or scrub never
   writes a shot or authorizes an export.

## Implementation details and boundaries
Uses only the existing CameraShot start/move/end values and the
existing PlaybackClock. For a full-duration move, the end marker is
displayed at 100%, but the jump seeks *inside* the half-open
shot end to prevent showing the next shot's camera.

The marker is visually distinct from PR #83's risky-geometry marks
and has an accessible labeled readout with a keyboard-usable button.
No changes to the Stage camera, captions, sound, recording, original
PNG frames, schema, backup, or genuine WebM export pipeline.

Pure tests cover half-open ends, early holds, shots that start after
time zero, and bad metadata. Browser tests verify the 75%-finish
scenario, accurate 1.50s/0.50s readout, actual preview seek, and
proposed-vs-saved behavior on desktop/phone/tablet.
Both Foundation/browser and real 20-minute narrated media export
gates must pass on the latest PR head before human merge.
