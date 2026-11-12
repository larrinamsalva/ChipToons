# PR #95 — Emotion-Cued Cinematic Reaction Acting

## Creative aim
Little Fixers Club characters should react *to the story* rather than
continuously bobbing. This polish is a small, deterministic Stage pass,
not an AI emotion detector, speech recognizer, separate render engine,
new rig format or imported 3D facial animation.

## Behavior
- Opt into the existing **Cinematic Storybook look**.
- For full-body vector puppets with authored animation, when a real
  emotion keyframe changes from the previous authored emotion, a brief
  0.56-second reaction settles in and out.
- Happy/excited: slight head response, warm smiling-eye squint.
- Surprised: a tiny head turn and raised asymmetric eyebrows, open eyes.
- Worried/sad: subtle opposite head response and gentler eyes.
- Calm: very small settling response.
- Motion remains bounded: max 1.7° head angle and 0.55° torso tilt.
  Facial reaction is a small addition to existing authored expressions,
  with no change to mouth phonemes, speech animation or manual mouth.
- Without an authored emotion *change*, visuals remain exactly as before.
  The first keyframe at time zero is treated as the initial pose, not
  an automatic reaction. Old projects with no animation are unaffected.
- Reactions depend only on saved element IDs, keyframe emotions and
  scene time. Scrub, replay and genuine WebM exports sample the SAME
  Stage frame; no wall-clock random motion or media synthesis.

## Safety and scope
- **Only Cinematic Storybook**; Classic and calm authoring previews
  stay identical.
- No new schema, keyframes, translations, character replacement, license
  integration, asset uploads, microphone access or saved project mutation.
- Painted/raster eyes remain artist-authored and untouched.
- Existing held objects follow the same actor frame as before;
  voice-to-mouth values and audio clip times do not change.
- This is an expression polish, not a full 3D character engine.

Tests verify bounded and deterministic reaction profiles,
no false reactions on unchanged authored expressions, opt-in/calm
behavior, accurate SVG face microperformance, original scene
preservation, and compatibility with actual recorded cartoon exports.
Require Foundation/browser and full 20-minute real narrated WebM
gates green at the latest commit before manual merge.
