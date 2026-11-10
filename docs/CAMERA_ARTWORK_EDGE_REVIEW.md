# PR #81 — Camera Artwork Edge Review

## Mission
Protect the final look of animated kid-friendly scenes by alerting
creators when a proposed camera move could show beyond the original
800×450 source canvas. This follows the three-frame Camera Motion
Contact Sheet delivered in PR #80.

## Using it
Open **Direct My Cartoon Camera**, choose **Preview Shot** or
**Preview Full Sequence**, then enable **Show beginning, middle and end
frames**. Below the three authentic Stage pictures, the contact sheet
gives a short advisory verdict and labels any frames whose camera
view rectangle extends left, right, above or below the original stage.

The detector inverts the exact Stage transformation:
translate(400,225), scale(zoom), translate(-x,-y).
At each of the three real animation times it uses the same
stageCameraAt evaluator as Stage playback and genuine WebM export.
The saved-camera **Compare** checkbox also updates the warnings,
so you can check proposed versus existing framing.

## Limits
These warnings are **advisory**, not an assertion of blank pixels.
Some custom backgrounds deliberately extend beyond the base stage,
or contain artwork despite the canvas coordinates. Conversely, the
detector cannot identify a cut-off face inside the canvas, because
that requires understanding the actual picture. Inspect each image
visually before pressing Apply. A safe verdict means only that the
three sample rectangles stay within the original canvas, not that
the complete motion is guaranteed perfect between samples.

No automatic editing or correction. No changes to source PNGs,
character keys, captions, voice recordings, shot types, real
exporter, video encoding, backups, or existing timeline data.
Only optional read-only preview analysis. Good dark mode/mobile
legibility and accessible warnings.

## Tests
Pure tests cover each canvas boundary, normal push/pan/reveal safe
framing, optional saved/proposed A/B scene analysis, exact Stage
sampling and nonmutation. Browser checks verify the advisory
status inside the existing camera review, without weakening the
required preview-before-Apply behavior. Both Foundation QA and
genuine 20-minute episode/video export gates must pass on the
latest commit before a person merges PR #81.
