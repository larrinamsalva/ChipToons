# PR #52 — Visible Finger Contact on Held Objects

The Cinematic Storybook renderer already has articulated wrists, finger
curl, real prop attachment and real handoff timing. This small finishing
pass adds a **foreground fingertip layer** during a real hold so the
checklist reads as physically gripped rather than pasted in front of a hand.

## What viewers see

- At roughly 7 seconds in **Watch Scout & Jo bend their elbows (0:30)**,
  small skin-toned fingertip strokes appear *in front of* the paper
  picture checklist where Scout's right hand actually holds it.
- At the 9.8-second handoff, fingertip contact follows the real transfer
  to Helper Jo's **left** hand.
- At release (12 seconds) the contact marks disappear; the prop settles
  by its existing saved interaction.
- Finger width and placement are deliberately restrained so they do not
  dominate tiny story objects or hide important lesson content.

## Technical details

- A deterministic, render-only helper `cinematicContactsAt` derives
  visible fingers from the **real held object**, the current `heldBy`
  owner, the matching action's saved hand, the owner's current
  `gripCurl`, and the existing original vector puppet.
- The overlay is drawn in Stage coordinates *after* scene objects, using
  the held prop's sampled position and any stage depth offset. The
  very same Stage renders preview frames and genuine WebM exports.
- `pointerEvents="none"` keeps the contact noninteractive, preserving
  object selection and editor gestures.
- No stored data, real hand positions, speech, camera, other objects,
  authored keys or original animations are moved or edited.

## Compatibility

- Requires opt-in `storybook-cinematic`, an actual held prop, and
  a complete original upper arm → forearm → hand hierarchy.
- Classic mode and calm authoring never draw these fingers.
- Painted hands or picture-cutout characters receive no synthetic skin.
- An object that is released, merely being pointed at, out of action
  range or held without a matching puppet grip receives no overlay.
- Works for either arm and for the recipient in a real two-performer
  handoff. No new schema fields or dependencies.

## Verification

`src/cinematic-contact.test.ts` checks precision against
`handAt`, owner changes, timing, release, real SVG paint order,
noninteractive markup, deterministic results, and safety fallbacks.
Both Foundation/browser QA and the 20-minute real-export job must
pass before merging.

This remains hand-drawn 2.5D vector animation, not a claim of full
physics-driven 3D fingers.
