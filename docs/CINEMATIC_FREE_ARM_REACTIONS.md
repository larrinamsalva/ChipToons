# PR #96 — Emotion-Cued Free-Arm Acting

## Goal
A small character-performance improvement for Little Fixers Club.
When an *authored* emotion keyframe changes, a character with unposed
free vector arms can make a gentle, temporary shoulder response in
Cinematic Storybook mode (maximum 2.5° per arm, settled in 0.56 seconds).

## Deliberately conservative
- No added keyframes or project-schema changes, and no surprise motions
  on unchanged expressions or at the initial pose.
- Any interaction involving the character anywhere in the scene
  disables free-arm polish to preserve hand grips, handoffs and props.
- Explicit authored arm poses, existing gestures, image-backed arms
  and incomplete rigs take priority. Classic and calm editor previews
  never receive this new animation.
- Existing face/emotion polish from PR #95, genuine Stage/recorded WebM
  rendering, voice-to-mouth, audio, captions, foot planting and authored
  actions keep their exact data and timing.

This is a small additive animation for free arms, not a full body-
language generator, an automatic gesture/audio analyzer, or a
replacement for the creator's hand-animation work.

Tests verify free arms respond and settle, both sides move in
opposition, authored poses and actor interaction cases remain
untouched, raster/partial arms fall back, seek determinism and original
project nonmutation. Manual merge only after both required checks pass.
