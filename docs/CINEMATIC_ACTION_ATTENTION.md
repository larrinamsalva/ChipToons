# PR #49 — Look at What You're Doing

ChipToons' Cinematic Storybook characters already have gentle eye glances,
blinks and expressive eyebrows. This small pass makes their eyes follow the
**actual moving story object** during an authored pickup, point or handoff.

## What viewers can see

- Scout looks down toward the moving picture checklist while lifting it.
- As the checklist reaches Helper Jo, Jo also looks at the same item instead
  of staring past it. After the handoff, each character returns to the
  existing natural conversational gaze.
- The gaze target comes from the real, sampled story-object frame; hand
  attachment, camera and actual exported video are generated from the
  same deterministic scene sampler. No independent timer or random animation
  can drift out of sync.
- New focus transitions use 320ms of easing at the start and 300ms near the
  end of the relevant interaction for less abrupt eye movement.

## What is protected

- Classic mode, calm editing and image-backed/painted eyes stay unchanged.
- Scenes without interactions still use the original alternating attention
  to nearby characters or props.
- Explicit no-blink choices are honored.
- The authored script, narration, audio and joint keyframes are not changed.
- The adjustment is limited to a maximum 2.6-SVG-unit pupil offset and
  1.6-SVG-unit vertical offset, as before.
- This remains two-dimensional vector eye acting in a 2.5D renderer, not a
  full new facial rig or photorealistic 3D simulation.

## How to test

Open **Watch Scout & Jo bend their elbows (0:30)** from ChipToons' dashboard.
Scrub around 7 seconds to watch Scout watch the checklist, then around
10 seconds to watch Jo look toward the arriving checklist. Check that the
characters return to conversational eye movement after the safe handoff.

The new unit test covers object tracking, incoming transfers, restoration
of ordinary gaze after release, deterministic seeking and Classic/calm/painted
eye fallbacks. Foundation browser QA and the full 20-minute export check
must both be green before merge.
