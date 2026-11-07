# PR #51 — Cinematic hands and wrist acting

ChipToons' original vector characters now have real parented upper arms,
forearms and hands, and the two-joint solver can point them toward a prop.
This improvement makes the **hands themselves** visibly take part:

- Scout's right wrist turns subtly as the picture checklist reaches his
  hand. Three small illustrated finger creases curl while the grip strengthens.
- Helper Jo's left wrist and fingers respond as the checklist is passed over.
  The grip transitions are tied to the same eased interaction clock used by
  the real hand anchor, instead of a separate free-running animation.
- Only **new, unkeyed vector hands** with a correct shoulder → forearm →
  hand hierarchy receive this optional helper. Existing hands and painted
  artwork are never replaced.
- Wrist turns are limited to **9 degrees**, and finger curl is clamped from
  0 to 1. Actual prop attachment reads the final hand joint from the same
  timeline, so the checklist remains attached during frame seeking, camera
  work and genuine exports.
- The hand drawing uses the existing skin tone with three little crease
  curves and a thumb line. No external art assets or photorealistic hand
  reconstruction is implied.

## Compatibility

This feature activates only for `storybook-cinematic` when an existing
interaction drives a real articulated wrist. Classic mode, calm editing,
custom keyframed wrists, painted hands, missing limbs, or out-of-range
motions retain the old visual and motion behavior. No scripts, character
data, voice recordings, saved actions or approved episodes are rewritten.

The full 30-second **Watch Scout & Jo bend their elbows** example is a
convenient way to see it in action: scrub around 7 seconds for Scout's
checklist grip, and around 9.6 seconds for Jo's receiving hand.

Tests assert that the rendered SVG contains the hand pose, that the
prop stays on the new hand anchor, that the result is deterministic,
and that Classic and authored wrist joints stay unchanged.

**Do not merge until Foundation/Browser QA and 20-minute genuine export
checks are green.**
