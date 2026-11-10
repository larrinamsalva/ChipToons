# PR #77 — Gentle Sideways Camera Movement on Imported PNG Cartoons

## Why

A real cinematic scene can slowly move across a picture, instead of
holding on a static wide view. ChipToons already has a reviewed camera
movement engine, so this adds a small optional direction preset instead
of a second renderer or simulated preview.

## Creator steps

Open an imported numbered-PNG cartoon, then **Finish My Cartoon →
Guided Voice Recording**, select a scene without existing authored camera
work and choose **Try a gentle cinematic side-pan**. A scene-specific
shortcut is also available in Caption & Voice Timing Review.

The existing **Direct My Cartoon Camera** editor opens a new editable
two-second-or-longer camera shot covering the real scene duration.
Choose **Slide view left** or **Slide view right** in the new direction
selector. The camera starts wide at 1× and gradually slides to
x=345 or x=455 while easing to 1.25× zoom. The extra zoom keeps the
image within the 800×450 composition while the camera moves.

Use **Preview Shot** or **Preview Full Sequence** and check text,
characters and captions before deliberately pressing **Apply**.
**Cancel** discards the draft without touching the project.

## Preservation

- The original numbered PNG assets, animation frame sampling, durations,
  words, narration, other audio, source files, backups and exports are
  untouched until the user explicitly applies an ordinary CameraShot.
- Existing camera shots and camera tracks are never replaced. The new
  shortcut appears only for eligible imported PNG scenes with wide
  framing and no previous camera work.
- This moves the **camera over 2D rendered frames**. It does not reconstruct
  editable 3D geometry, generate novel in-between frames or promise
  new 3D character animation.
- Approved shots play and export with the **same Stage**, animation
  timing, local audio mixer and genuine WebM exporter already in ChipToons.
- The existing push-in preset remains available and unchanged.

## Tests and merge requirements

Unit tests cover left/right camera samples at beginning, middle and end,
no changes before Apply, project schema validation, refusal to replace
existing camera work, invalid directions, and untouched other scenes.
Desktop/phone/tablet QA exercises an actual second imported PNG scene,
chooses the rightward pan, previews and explicitly applies it. Both
Foundation/browser QA and the independent genuine 20-minute narrated
movie + exports must be green at the current commit. Human review is
required before any merge. No automatic publishing.
