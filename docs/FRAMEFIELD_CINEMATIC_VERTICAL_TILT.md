# PR #85 — Vertical Cinematic Tilt for Imported Numbered PNGs

## Why
Kids' stories sometimes need a gentle look **up** toward a tree or sky,
or **down** toward a workbench, wheel or toolbox. This feature moves
the real authored camera over the existing numbered PNG frames, instead
of adding a separate fake motion or export pipeline.

## Creator steps
Open a storyboard cartoon built from numbered PNG frames. In
**Finish My Cartoon → Guided Voice Recording** choose an eligible
scene and select **Try a gentle cinematic vertical tilt**. A similar
per-scene shortcut appears in **Caption & Voice Timing Review**.

The existing **Direct My Cartoon Camera** dialog appears with a
full-scene move. Choose **Look upward across the artwork** or
**Look downward across the artwork**. The camera moves from the
original wide view at (400,225) and 1× zoom to x=400,
y=190 (up) or 260 (down), zoom 1.25×, with the usual smooth easing.

The target crop stays within the original 800×450 source canvas:
at 1.25×, the visible half-height is 180 pixels, leaving at least
10 px of room above or below the extreme target frame. The actual
Camera Motion Contact Sheet, 21-point exposure check, live meter,
and scrubber can be used to inspect framing and timed captions.

Choose **Preview Shot** or **Preview Full Sequence**, then explicitly
**Apply**. Cancel discards the change without touching your project.

## Boundaries & preservation
- Only eligible original multi-shot PNG cartoons without existing
  authored camera shots/tracks, and using wide default view, expose
  this shortcut.
- Existing shots, voice recordings, timing, captions, frames, local
  projects, backups and source assets remain unchanged. Applied
  motion becomes a normal CameraShot.
- The approved camera is sampled by **the same Stage and genuine
  WebM exporter** as every other camera move. No independent rendering,
  new tweened PNGs, real 3D reconstruction, autoplay or publication.
- The three-frame and 21-point scan report canvas geometry, not
  image semantics: the author still checks important subjects.

## Verification
Pure unit tests check both up and down, valid schema, source
nonmutation, exact camera frames and edge safety, and rejections
for incompatible authored camera work. A browser test imports a
real two-scene PNG sequence, selects Down, previews the real
contact sheet, then explicitly Applies. Foundation/browser QA and
full 20-minute genuine narrated WebM export must both pass on
the latest commit before any manual merge.
