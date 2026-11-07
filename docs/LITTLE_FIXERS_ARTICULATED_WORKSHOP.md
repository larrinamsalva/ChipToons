# PR #48 — Scout & Helper Jo's Articulated Workshop

This phase puts the new two-joint arm system into an **actual playable,
editable, saved original cartoon**, not just a helper function.

## Try it

On the ChipToons start dashboard, choose **Watch Scout & Jo bend their
elbows (0:30)**. The new 30-second Cinematic Storybook demo opens in the
normal cartoon editor. No account is required for the demo.

Scout wears the workshop outfit with cargo pants, tool belt and boots. Helper
Jo wears a distinct grown-up outfit. Both are original vector characters
with **real independent upper arms, forearms and hands**. Scout shares a
paper picture checklist with trusted grown-up Helper Jo.

- Scout's right arm has a genuinely parented right forearm and right hand.
- Jo's left arm has a genuinely parented left forearm and left hand.
- Both free joints can move using the opt-in two-bone solver while the
  original pickup/transfer/release timeline attaches the checklist.
- The receiving puppet aims toward the **shared picture checklist** rather
  than the giver's torso; the prop still follows the existing hand anchor
  and keeps its saved handoff/release times.
- There is no adult tool use by Scout, no dangerous repairs and **no
  unapproved voice recording**. Text in the demo is a script/caption
  draft, not spoken narration.

## No regressions to older episodes

The 34-second Scout pilot and the approved multi-scene Little Fixers demos
are unchanged. The new fully parented rigs are only created in this
separate, self-contained cartoon demo. We do not silently replace their
existing character IDs, joint animation keys or project files.

The new demo is still 2.5D vector animation, not a claim of physically
rendered 3D meshes. It demonstrates visible joint articulation with the
same Stage and interaction sampler used for exports.

## Merge criteria

- Foundation/type/lint/unit and browser QA green.
- New browser workflow can open the demo, make a portable backup, validate
  both animated elbow joints during the handoff, and reopen saved work.
- Complete 20-minute test-export workflow green; no auto-merge.
