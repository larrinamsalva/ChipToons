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
- **PR #106:** Scout now directs his generated eye gaze toward actual
  Helper Jo during each of the three original, script-linked and recorded
  speaking close-ups. A smooth, seek-deterministic gaze hold starts and
  ends with the authored shot, including gaps between syllables. Require
  an intact real recording link and never modify a voice, mouth, head rig,
  manual action, camera or saved keyframe. Calm editor and Classic remain
  unaffected, as do separately authored/painted eyes.
- **PR #107:** in the two quiet shared-pair shots, Scout and Helper Jo
  keep gentle mutual pupil eye contact with soft entrances and exits,
  instead of the incidental room-scanning cycle interrupting their
  conversation. Requires an existing, explicitly authored two-actor
  "pair" camera record and actually visible performers; no new voices,
  additional camera cuts or edited keyframes. Speaking/listening cues,
  original prop interactions, Classic and calm editing retain priority.
- **PR #108:** the two longer shared-pair views use a small, deterministic
  stagger: Scout turns his generated pupils toward Jo first, Jo follows
  160 ms later and holds slightly longer at the end of the camera shot.
  The original short establishing view retains its simultaneous gaze.
  All actual eye positions still use saved actor frames; no edited
  audio, new keyframes, camera changes or invented dialogue.
- **PR #109:** the existing final wide shot closes with a friendly
  audience-facing look from both performers, after the real Camera Director
  move has settled. Scout gently leads and Jo follows. This read-only
  vector-pupil/cheek accent is skipped during voice, hand actions,
  manually painted faces and calm editing. No wave is fabricated; no
  new recordings, animation keys or shot edits are made.
- **PR #110:** Scout's three authentic recorded close-ups gain a small
  voice-paced body breathing / lean accent, sampled from the same approved
  lip-sync envelope as his existing speech. The original hand-animated
  arms, legs, lips and head pose remain intact; no fake recording, added
  motion keyframe, new scene or camera timing edit. The accent vanishes
  for silence, edited/muted voice, manual gestures or active prop work.
- Stage and genuine WebM playback use the SAME existing camera-shot
  time sampler. No new engine, generated image frames or CSS-only
  animation claims.
- Preserve every original approved audio clip and asset, caption,
  lip-sync correction, character animation keyframe, prop contact,
  browser backup, exported source and project ID graph.

- **PR #111:** the creator's Camera & Shot Director includes a read-only,
  draft-inclusive coverage review. It displays exactly which seconds use
  custom shots, which intervals use the safe default camera, and where
  actual assigned voice clips start relative to both. The review changes
  no saved camera, animation, voice, caption, media or export data.
  Gaps are informational, not automatically errors.

- **PR #112:** the read-only Camera Coverage Review now offers
  accessible "Inspect gap" and "Inspect voice" controls. Each seeks
  the existing full-sequence Stage preview to the relevant camera gap
  midpoint or exact recorded voice start. It never applies or edits a
  shot, original audio, captions or project data, and Cancel leaves
  the original scene unchanged. Repeated jumps reset only the temporary
  preview clock.

- **PR #113:** the final pre-export Episode Narration Review now includes
  a read-only whole-episode camera summary: saved custom-shot seconds,
  default-camera intervals and genuine recorded voice starts using the
  default view, organized by scene. Creators can open any scene for further
  camera review without silently modifying shots or blocking valid exports.
  The complete 20-minute media-export gate remains independent.

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
