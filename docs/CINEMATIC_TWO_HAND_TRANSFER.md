# PR #53 — Natural Two-Hand Overlap and Soft Grip Release

**Goal:** When Scout gives the picture checklist to Helper Jo, the fingers
should not pop from Scout's hand to Jo's hand instantaneously. For a brief
moment before the real transfer, both performers can be seen touching it.

This phase changes only the **illustrated foreground finger contact** in
Cinematic Storybook scenes:

- Scout's fingers fade as the authored 9.8-second handoff approaches.
- Jo's fingertips begin to show up to 0.32 seconds before transfer, using
  Jo's **actual animated** left-hand grip strength.
- Both small contact overlays may appear together for a moment, on
  opposite sides of the picture checklist. Their SVG keys are separate.
- The prop itself has exactly one real `heldBy` owner throughout. This
  render-only layer never reattaches, duplicates or teleports the object.
- Contact fades into the initial pickup and gradually out of the final
  release, disappearing entirely on the saved release frame.

## Safety and compatibility

- No alteration to scene schema, source projects, animation keyframes,
  wrist motion, dialogue, voices, hand anchors or recorded exports.
- Classic mode, calm authoring and painted-image hands remain unchanged.
- An object with no real holder or no valid, complete vector hand has
  no added contact.
- The effect is deterministic at any seek time and appears in the same
  Stage drawing used for previews and video export.
- The original successful two-joint reach, gaze, head-turn and finger
  movements from PRs #47–#52 remain independent.

## Review the scene

Open **Watch Scout & Jo bend their elbows (0:30)** from ChipToons'
start screen and inspect the checklist at ~9.3, 9.7, 9.8 and 10.3 seconds.
At ~9.7 seconds two small contact marks should be present while **Scout
still owns the prop**. At 9.8 seconds Jo becomes the owner. Around 11.9
seconds the final grip gently fades, and at 12 seconds all contacts vanish.

Unit tests verify the actual prop ownership never changes early, both
contacts have distinct roles, the SVG overlays appear *after* the prop,
and full release/missing-hand and Classic-mode fallbacks continue to work.

**PR is a draft: require green Foundation/Browser QA and a full
20-minute genuine-export check before merge.** No automatic merge.
