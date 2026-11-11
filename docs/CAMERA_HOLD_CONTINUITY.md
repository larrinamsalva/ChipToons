# PR #91 — Five-Point Camera Hold Continuity Check

## Why
Two real Stage frames at the beginning and end of a camera hold
(PR #90) make a good comparison, but may miss what happens between.
This optional extension checks **five actual moments** throughout a
held shot, without creating a second animation engine or mutating
the scene.

## Creator workflow
1. Open **Direct My Cartoon Camera**, edit an existing camera move
   with a final hold or choose a reviewed original-PNG diagonal glide
   that finishes halfway or at 75% of the shot.
2. Select **Preview Shot** or **Preview Full Sequence**, enable
   **Show beginning, middle and end frames**, then expand
   **Review final-view hold frames**.
3. The **Five-point camera hold check** inspects the exact same Stage
   camera and timed caption evaluator as the live animation:
   - Whether camera framing has changed from the settled position at
     any of the five sampled moments. For a tracking/follow shot,
     this movement can be deliberate, so it is an advisory.
   - How many of four consecutive sample intervals show different
     text captions.
   - Whether any sampled camera view extends beyond the original
     800×450 artwork canvas.
   - Whether the selected camera shot is active at all five times.
4. Choose **Inspect hold checkpoint 1–5** to seek the genuine preview
   to that exact moment and inspect animation and subtitles.
5. Use **Compare with saved camera** for the saved scene or explicit
   **Apply** to approve edits. If no saved shot has a final hold,
   the review disappears during comparison.

## Limits and preservation
These are discrete snapshots, not continuous proof, pixel-diffing,
character face detection, or proof that original PNG frames stop
animating. A visually steady camera may still show moving characters
or changing captions, as it should.

The existing two large true Stage images stay exactly as before;
this feature adds a small, readable checkpoint report and five
seek buttons. The sampled info is computed only when review is
opened. All checks are client-side and read-only. No original
PNG frames, artwork, scene durations, recordings, captions,
CameraShot schema, backups, or genuine WebM export logic change.

Verification includes real Stage continuity for a settled 1.4×
diagonal glide, synthetic drift/caption/edge detection cases,
source preservation, and desktop/phone/tablet browser seek checks.
Require both Foundation QA and full narrated 20-minute real media
exports to pass on the current head before manually merging.
