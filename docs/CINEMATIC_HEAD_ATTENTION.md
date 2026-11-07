# Cinematic head attention — PR #50

**Goal:** Give Scout, Helper Jo, and other original vector puppets a small,
readable head turn that agrees with their real eye direction during
pickups and handoffs, making action feel intentional rather than disconnected.

## What changed

- During an existing authored `scene.interactions` action, a performer can
  tilt their head very slightly toward the **actually moving story object**.
  The animation uses the same sampled scene frames that drive the prop,
  the real hand attachment and the final video export.
- The maximum added head turn is **5.5 degrees**. It eases in over about
  0.36 seconds and eases out over about 0.34 seconds, reaching zero at
  each gesture's boundaries.
- This is an *additive*, render-only layer applied **after** the existing
  foot, head follow-through and object interaction passes. It preserves the
  original head keyframe's angle and all authored animation data in storage.
- Stage preview, frame seeking, recorded WebM and portable project backup
  continue to use the same deterministic timeline. No timers or randomness.

## Backward compatibility and safety

- Only `storybook-cinematic` projects use this feature.
- Classic mode and calm edit preview are unchanged.
- Image-backed head parts are left alone.
- Missing, hidden and out-of-range objects fall back to the prior motion.
- No dialogue, sound, mouth movement or voice approvals are generated.
- Older Scout cartoons without active interactions remain as they were.

## See it

Open **Watch Scout & Jo bend their elbows (0:30)** from the ChipToons
dashboard. Around **7 seconds**, Scout's head turns slightly while
handling the picture checklist. Around **10 seconds**, Helper Jo follows
it as it is handed over. After the handoff, the added head turn settles
back to the original expressive pose.

## Merge gates

- Foundation, tests, build and browser QA green.
- Complete 20-minute genuine export workflow green.
- Visual review to check the head stays subtle at every frame and the
  child-safe checklist interaction remains clear.

This remains original, editable **2.5D vector-puppet animation** rather than
photorealistic 3D mesh animation. No release or merge is automated.
