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
