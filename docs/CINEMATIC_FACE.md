# Cinematic Storybook: expressive generated faces (PR #45)

Scout, Helper Jo, and other rigged vector puppet characters gain understated,
time-based facial attention **only** when the project opts into
`storybook-cinematic`.

## What is animated

- Pupils and the catchlight move together a few SVG units, glancing between
  the viewer and the nearest scene partner. If no partner is nearby, a workshop
  prop can become the focus of attention.
- A small eyebrow lift responds to the existing authored emotion and optional
  measured voice opening; mouth/lip-sync tracks remain unchanged.
- A brief anticipatory blink accompanies the change of attention, but never
  overrides `animation.blink: false`.
- Rendering is deterministic for any saved scene time, including frame seeking
  and recorded WebM export. No timers, random seeds, new keyframes, or saved
  project schema fields are needed.

## Safety and compatibility

- The Classic style and calm editor views render as before.
- A rig without a generated face/head and rigs using asset-backed eyes receive
  no generated gaze offsets. The animator's own image art stays in control.
- Rendered pupil travel is bounded to ±2.6 horizontally and ±1.6 vertically;
  brow lift is bounded to 1.9.
- Existing emotional expressions, explicit mouth shapes, measured speech
  synchronization, authored joints and camera/prop anchors are preserved.
- This is polished 2.5D vector acting, not 3D mesh animation or AI-generated
  speech.

## QA

Verify `src/cinematic-face.test.ts` along with the existing full suite.
Scrub Scout's workshop pilot at different times and replay the same moments:
the eyes should make small, repeatable glances. Confirm Classic and calm
authoring remain unchanged, then review desktop, phone and WebM export
using the normal repository checks.
