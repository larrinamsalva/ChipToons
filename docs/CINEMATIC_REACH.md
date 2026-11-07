# PR #46 — Cinematic Reaching & Object Handling

**Goal:** When an original rigged cartoon performer reaches for a nearby
story object, turn the free puppet shoulder toward the *actual saved object
position* instead of merely swinging left/right by a fixed angle.

This is a small additive pass in ChipToons' existing interaction engine, not
a replacement for it or a new project format.

## How it works

- An action's existing `start`, `attach`, `transfer`, `release`, and
  `finish` timestamps still drive all movement.
- For opt-in Cinematic Storybook projects, an unkeyed, vector-puppet upper arm
  points toward a nearby story object. During transfer, the receiving puppet
  can turn toward the giver. Its angular adjustment eases in and out, with a
  maximum correction of 62 degrees from the original pose.
- Stage coordinates are converted back through the character's translation,
  rotation, scale and flips. The original `handAt` anchor is then used to
  keep held objects physically attached to the resulting animated hand.
- Existing release positions and painting order are unchanged. Frame seeking
  and WebM export use the same deterministic scene sampler.

## Safety and limits

- All existing Classic-mode behavior is unchanged.
- Calm authoring previews do not receive the Cinematic Storybook targeting.
- If a puppet hand/forearm/upper arm already has authored joint keys, **those
  joints take priority**; the helper never replaces them.
- Rigs without an appropriate upper arm, painted arm artwork and targets
  outside practical reach fall back to the existing stylized interaction.
- No object is teleported toward its target by this helper; prop attachment
  remains controlled by the original interaction timeline and hand anchor.
- This is two-dimensional vector-puppet shoulder aiming (within the 2.5D
  storybook renderer), not a claimed full 3D IK solver. The next improvement
  can add optional forearm-specific refinement for rigs that support it.

## Verification

Run the complete repository checks. New tests specifically cover
non-destructive Cinematic opt-in behavior, the real held-object hand anchor,
calm previews, authored keyframe priority, rotated/mirrored actors, bounds,
missing geometry and deterministic seeking. Existing 20-minute export checks
must still pass before merge.
