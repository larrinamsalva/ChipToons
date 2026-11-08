# PR #54 — A shared glance and gentle nod after a safe handoff

After Scout passes the picture checklist to trusted Helper Jo and it is
safely placed on the workshop table, the two performers now **briefly look
toward one another and nod**, acknowledging that they worked together.

This helps the child viewer understand a simple social skill: finish a
shared task, make eye contact and recognize the other person's help.

## What the animation does

- Only an existing, completed and **explicitly authored** `give` or
  `receive` action with a trusted recipient and saved release creates
  an acknowledgement. There is no invented plot event.
- The giver starts a small, downward/upward nod just after release;
  the receiver responds about 0.15 seconds later. The movements are
  staggered rather than perfectly synchronized.
- Both characters look toward the **other performer's actual sampled
  position**, not toward a generic screen coordinate.
- The nod is at most **2.8 degrees** and the gaze uses the existing
  bounded premium vector-puppet pupils. Both return smoothly to the
  original authored expression and head pose after about a second.
- The 30-second Scout/Jo workshop demo makes this visible around
  **12.4–13.2 seconds**, after the checklist is released at 12 seconds.

## No destructive changes

- This is an opt-in render-only Cinematic Storybook performance layer.
  It does not add persisted keyframes or change a character rig, object,
  prop ownership, story, spoken dialogue, audio recording or export format.
- Classic mode, calm editing, painted heads and image-backed eyes remain
  unchanged. New authored interactions take priority during the short
  acknowledgement window.
- Seeking and genuine video exporting use the same deterministic scene
  sampler and face rendering as the editor.
- No full three-dimensional facial mesh or motion capture is implied.

## Verification

`src/cinematic-handoff-acknowledgement.test.ts` checks the two different
nod times, eye direction, real release time, exact keyframe preservation,
deterministic seeking, stillness outside the reaction and Classic/painted
head/authoring fallbacks.

**The two required merge gates are Foundation + browser QA and the
complete 20-minute genuine-export check. Do not merge automatically.**
