# ChipToons — PR #40: More Lifelike Character Movement

## Mission

Improve the *actual motion* in existing **Cinematic Storybook** cartoons without changing their scripted timing, keyframes, voices or objects. This is a small, real second increment after the merged PR #39 lighting/face pass—not a claim of 3D model rendering or a finished movie-quality show.

## What was already in the engine

- Rigged vector characters with authored leg, arm, head and body keyframes
- Eyes, blinking, breathing, mouth shapes and waveform-driven approved speech
- Interpolated positions and camera following
- Real hand and object attachment (the checklist, warning sign, toolbox)
- Shared Stage rendering for editor, playback and genuine video export

## New: deterministic secondary character acting

- The **Cinematic Storybook look** switch (existing from PR #39) now also activates non-destructive acting polish for *rigged characters*.
- Moving actors gain **subtle alternating body lean, small weight-transfer bob and tiny squash/stretch** based on the actual direction and speed of their existing position animation.
- Heads gain **gentle, opposing follow-through** during movement and an understated listening/attention sway at rest. The effect adds to the existing head-joint keyframe rather than replacing authored acting.
- The movement follows the character's actual velocity sampled from the *existing* timeline curve; it disappears when the character stops. Very small amplitude keeps children-friendly gestures readable without undermining dialogue.
- **No new saved keys**, no destructive re-timing, no random animation, no additional camera wobble, no changed speech recordings, and no fake lip-sync.
- All characters do **not** move in lockstep: each actor's stable ID gives a deterministic unique motion phase.
- The polished `ElementFrame` is produced **inside shared `sceneElementAt`**, before interaction sampling. Camera tracking and hand-anchored props see the exact same actor transformation as the actual SVG puppet. Held checklists, tools and warnings **remain attached** rather than drifting away during the lean/bob.
- Preview, on-device player, and real WebM frames use the same Stage and scene-frame sampling. Calm authoring/keyframe editing disables the secondary layer; classic/legacy projects have exactly the same movement they had before.

## PR #132 — Walking stop follow-through

- Cinematic Storybook now adds a tiny, automatically fading **torso lean
  and opposing head correction** when a rigged character's already-authored
  walking motion decelerates to a stop. It samples the actual saved timeline,
  so stopping while walking left mirrors stopping while walking right.
- Constant-speed walking, long stationary holds, calm authoring and classic
  visual style do not gain the stop reaction. Artist-authored x/y locations,
  mouth shapes, emotion, voice clips and keyframe timing remain unchanged.
- Because the motion is added to the shared actor frame, the existing
  hand-anchored props and camera follow use the exact same pose as Stage.
  This is a restrained 2.5D animation refinement, not new 3D physics.
- Unit tests verify direction, bounds, deterministic seeking, stillness,
  unchanged authored movement and classic mode; the existing browser/real
  20-minute export proof remain mandatory.

## PR #133 — Walking anticipation before the first step

- Cinematic Storybook rigged characters now give a **subtle preparatory
  backward torso lean and counter-rotating head** just *before* an
  already-authored horizontal walk starts after a pause. The movement
  is driven by looking briefly ahead on the existing saved position
  curve; it is not generated movement or a new artist keyframe.
- Anticipation eases away when the walking translation begins.
  Constant-speed walks, stationary holds, vertical movement,
  classic cartoons, and calm authoring previews are unchanged.
- Original stage x/y coordinates, saved keyframes, approved dialogue
  and lip-sync, prop handoffs and export timing are untouched. Motion
  is added to the one shared character frame that all preview,
  cameras, interactions and WebM exports already sample.
- Tests cover left/right mirror behavior, no idle/vertical ghost
  steps, scene boundaries, deterministic seeking, unchanged saved
  projects, calm authoring and opt-in style. Not a claim of 3D physics.

## PR #134 — Eyes lead a character's first step

- A very small, **directional eye glance** can lead an explicitly authored
  walking start before the original body movement begins. It uses #133's
  same deterministic pre-step velocity samples rather than guessing
  future dialogue or adding a new walking track.
- Scene actions, prop handling, actual recorded conversation,
  mutually framed camera pairs and authored finale attention retain
  **higher priority** than this incidental walking look. The eyes return
  to the ordinary existing gaze when the step is underway.
- Only a generated vector-puppet face in the opt-in Cinematic
  Storybook mode is eligible; painted eyes, Classic appearance and
  calm editing remain unchanged. No new saved keyframes, eye assets,
  camera cuts, audio edits or output format changes.
- Focused tests verify the left/right direction and flipped puppets,
  stationary/non-walking fallbacks and integration with the real face
  renderer. All existing browser and genuine 20-minute media-export
  checks remain required.

## PR #135 — Eyes settle at the end of a walk

- A small, temporary **eyes-forward arrival glance** follows a character's
  already-authored horizontal walk as it slows to a stop. It uses #132's
  deterministic stop-settling samples; no invented travel, new keyframes
  or re-timing of the story or sound.
- The gentle eye focus fades as the performer comes to rest. Leftward
  walks and intentionally mirrored puppets get matching directions.
- Existing filmed action attention, prop handling, actual recorded
  conversations, speaking/listening and authored pair/finale framing
  all outrank this low-priority walk cue. Calm authoring, Classic style,
  raster eyes and unkeyed/static actors remain unchanged.
- Unit and real face tests verify deterministic seeking, directional
  gaze, stillness, opt-out and unchanged saved positions. Full original
  browser workflows and 20-minute genuine export QA remain required.

## Safety, compatibility and honesty

- A child does not start handling adult tools; Jo's dangerous props stay adult-only.
- The unsafe chair remains off limits. PR #38 was merged; PR #40 adds **no new story scenes**, so the 4:30 original cartoon stays 4:30.
- This is a **2.5D animation-motion refinement**, not a new 3D skeleton, photorealistic asset generator or automatic film-quality animator. Additional model-sheet, sophisticated acting curves, multi-joint rigs, shadows and character redraws will be future reviewed increments.
- Does not add paid APIs or external services.
- Existing `Project.visualStyle` opt-in remains unchanged. Backups, schema, roles, voices and camera shot data remain backward-compatible.

## Tests and acceptance

- Unit tests: opt-in only; motion changes Y/rotation/additive head angle but preserves authored X and voice-mouth/emotion/blink; fixed frame samples deterministic; no edits to the Project JSON; calm/legacy unchanged; no-rig and no-head safe.
- Browser test: existing Scout-and-Helper-Jo sign scene has 3 original approved voice lines and no changes to clips, captions, scripts, characters or authored scenes; enabling premium produces actual additional actor motion; **Jo's real carried sign remains at the moving hand anchor** and releases beside the chair, not drifting or touching it; user can save/reopen and revert to classic.
- Prior Playwright desktop/mobile/tablet/Firefox/WebKit browser suite, 20-minute **media engine fixture**, and genuine earlier exported 2.5D cartoon segments remain intact. Media fixture ≠ finished Little Fixers episode.
- Review the visible moving cartoon with toggle on/off in Stage, then a genuine exported part. Tests must pass, then owner reviews/merges.

**Do not auto-merge or publish.** Preserve PRs #1–#39 as already merged.
