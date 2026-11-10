# PR #84 — Live Camera Framing Meter

## The upgrade
Inside the real **Direct My Cartoon Camera** preview, the existing
motion scrubber now shows a **Live camera framing meter**.

As the creator plays, drags, or uses the arrow keys to inspect an
animated shot, the meter refreshes with:
- The real camera zoom at the current scene time.
- Whether the visible camera rectangle extends past the original
  800×450 source canvas, and which edge(s) it crosses.
- If outside, the approximate percentage of the camera's view that
  lies beyond the original canvas.

This is a readout of the **exact Stage camera computation** with the
same scene frames, voice offset and reduced-motion option. It
automatically follows **Compare with the saved camera** because the
preview receives whichever real scene is selected.

The meter is advisory. It does not detect individual pixels, faces
cropped inside the canvas, or images that intentionally extend beyond
the stage. It doesn't make, approve or save any camera edits.

## Preservation
Only the camera editor's existing opt-in preview gains a readout.
The real animator, source PNGs, voice, captions, backing projects,
scene durations and genuine WebM export engine are unchanged.

Desktop/phone/tablet browser tests check the live readout during
real camera scrubbing. Pure tests check identical Stage camera values,
per-frame boundary geometry and unchanged source projects. Review
Foundation, cross-browser and independent genuine 20-minute WebM
proof at the latest PR head before manually merging. No automated
merge, tag or deployment.
