# PR #79 — Adjustable Cinematic Reveal Starting View

## What changed

The optional close-to-wide cinematic pull-back added in PR #78 no
longer has to start in the middle at exactly 1.45×. Inside
**Direct My Cartoon Camera**, a proposed (or reopened, editable)
pull-back now has **Reveal starting focus** and **Reveal starting zoom**.

Choose left, center or right focus on the creator's original artwork.
Set a gentle close-up strength from 1.15× to 1.85×. At any strength,
the lateral focus is kept within the actual 800×450 frame by using
65% of the available safe camera offset, so the camera doesn't expose
a blank strip outside the source image.

## Workflow

In **Finish My Cartoon → Guided Voice Recording**, choose **Try a
cinematic pull-back reveal**. In the existing Camera Director, select
the starting focus and close-up zoom, then preview the real shot and
captions with **Preview Shot** or **Preview Full Sequence**. Explicitly
press **Apply** to save or Cancel to discard the proposal.

Existing pull-back shots can be reopened and adjusted using the same
fields. The original shot end framing remains editable through the
normal Camera Director. Changing a shot to incompatible movement,
start time or tracking clears the optional start-frame property.

## Protection

The actual Stage renderer and local verified WebM exporter share the
same saved camera values; no new video or frame-generation engine is
added. Original PNGs, sound, captions, trims, scene order, other
camera shots, older projects and backup files remain unmodified.
Any actual change requires explicit review and Apply. This feature
does not reconstruct editable 3D objects from 2D images.

Verification includes pure tests for safe left/center/right
composition at the minimum/maximum zoom, scene validation,
deterministic camera time sampling, source preservation and real
imported-PNG desktop/phone/tablet browser QA with explicit Apply.
Foundation and the full 20-minute genuine-export workflow must pass
on the exact PR commit before manual merge.
