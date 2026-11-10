# PR #86 — Safe Diagonal Cinematic Glide for Original PNG Cartoons

## Why
A soft camera glide can guide the viewer's attention through a scene:
up and left across a sky, up and right to a tree, or diagonally down
toward a workbench. The motion is a **camera move over the original
raster frames**, not newly generated 3D objects or frames.

## Creator workflow
Open a multi-shot cartoon built from numbered PNGs. In
**Finish My Cartoon → Guided Voice Recording**, choose an eligible
scene and click **Try a gentle diagonal cinematic glide**. The
same shortcut appears in **Caption & Voice Timing Review**.

In **Direct My Cartoon Camera** choose:
- Look up and left
- Look up and right
- Look down and left
- Look down and right

The move begins on a wide (400,225), 1× view and gently eases to
(335 or 465, 190 or 260), 1.3×. At this zoom the visible
half-width/height are ~308/~173 original-source pixels, preserving
healthy boundary margins. The whole eased move remains in bounds.

Use **Preview Shot** or **Preview Full Sequence**. You can inspect
all three genuine Stage frames, the 21-point safety scan and the live
camera scrubber, and compare against saved framing. Then select
**Apply** to approve or **Cancel** to leave the original untouched.

## Preservation
- Eligible only for numbered-PNG scenes using default wide view
  without previous authored camera shots or tracks.
- Normal CameraShot and Stage timeline / genuine WebM path; nothing
  is duplicated in the export pipeline.
- No original PNG replacements, fake interpolation of character
  motion, audio edits, caption changes, automatic merges or uploads.
- The canvas boundary check does not understand what characters
  are important: visual review is still required.

## Checks
Unit tests cover all four directions, deterministic Stage timing,
bounds along each movement, schema checks, rejection of existing
camera work, and unchanged other scenes and media assets.
Browser regression imports a real two-scene PNG cartoon, chooses
down-right, verifies the three-frame contact sheet, 21-point scan,
saved-vs-proposed A/B comparison and explicitly approves the shot.
Do not merge until Foundation QA and full narrated 20-minute genuine
WebM exports are green on the latest commit.
