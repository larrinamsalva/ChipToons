# PR #102 — Original-Voice Cinematic Conversation Camera

## New no-login playable cartoon
Choose **Watch cinematic Scout and Jo camera cuts (0:34)** on the
public ChipToons home screen. The separate editable project
**Scout & Jo's Cinematic Conversation** uses nine genuine camera shots:
a two-character establishing view; Scout close-ups on each of the
three existing approved voice recordings; shared two-character views
and Helper Jo's silent listening/reaction close-ups; and a wide
workshop ending.

## What's real
- Starts from the already merged PR #101 34-second playable cartoon;
  no changes to the original single-performer or listener-only demos.
- References Scout's existing three **approved recorded audio clip
  positions**, existing saved voice-to-mouth timing and original
  script line IDs. No invented words, extra lines or fake Jo voice.
- All nine shots are ordinary **editable Camera & Shot Director
  records** with verified unique IDs, contiguous half-open timing,
  legal zoom, existing character targets and original script links.
- **PR #103:** the first establishing shot stays steady; the following
  eight shots use short, saved Camera Director move intervals (0.48–0.82s).
  At each shot boundary, the rendered camera eases from the prior real
  composition into the next shot rather than hard-snapping. These are
  native, separately editable camera settings—not fake CSS transitions
  or new animation tracks. The original voice-timed cut boundaries stay
  fixed, and editor/preview/genuine video export share the same sampler.
- **PR #104:** the three Scout close-ups use the editable Camera
  Director "left" placement, while the two Jo reactions use "right".
  This maintains the characters' established left-to-right relationship
  and opens natural look room toward each other. Paired and wide views
  remain centered. New browser assertions sample ACTUAL rendered
  camera positions: Scout sits left of center and Jo right of center,
  without modifying their characters, recordings, shot starts or
  transition timing.
- **PR #105:** while Jo is the explicit subject of an editable "reaction"
  shot, Jo's generated eyes, brows, cheeks and small head tilt hold toward
  the other visible performer, then ease back at shot boundaries. This
  uses the actual sampled positions, creates no Jo audio or lip-sync,
  and leaves manual poses, prop actions, painted eyes, Classic and calm
  editor previews untouched. Stage and WebM use the same frames.
- Stage and genuine WebM playback use the SAME existing camera-shot
  time sampler. No new engine, generated image frames or CSS-only
  animation claims.
- Preserve every original approved audio clip and asset, caption,
  lip-sync correction, character animation keyframe, prop contact,
  browser backup, exported source and project ID graph.

## Quality gates
- Browser QA opens this distinct no-login example, verifies nine
  proper shots at the three original audio starts, checks their
  stage camera values and actual source/voice preservation.
- Validate deterministic playback and save/reopen, camera editing
  safety and full compatibility with the unchanged long-episode
  narrated 20-minute production export test.
- Merge only after both Foundation/browser and real export CI pass
  on the latest PR commit. Leave the PR in draft for human review.

This is deliberate 2D cinematic **camera coverage**, not a claim
of fully rendered 3D cinematography or a newly recorded dialogue.
