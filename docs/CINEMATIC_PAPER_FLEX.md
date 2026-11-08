# Cinematic Storybook — real carried paper flex (PR #55)

After Scout and Helper Jo began gripping and passing their picture
checklist naturally, this phase gives the paper a quiet, believable
flex while it is **actually held**.

- A small original vector fold appears at the upper corner when an
  opt-in Cinematic Storybook **book** is attached to a performer's hand.
- The fold eases in after pickup, bends slightly more during the
  authored transfer to Helper Jo, then settles away before release.
- The saved book remains in the *exact same place*. The effect changes
  neither the real grip anchor, the object's timing and `heldBy` owner,
  the complete episode's arrangement nor the character rig.
- At 7 seconds of the 30-second workshop sample, the checklist has
  a small bend; around 9.8 seconds, it flexes just a little more during
  transfer; at 12 seconds it is fully flat again.
- This effect is entirely based on the existing interaction times,
  sampled `heldBy` state and local scene time. Scrubbing to an exact
  frame or making an export produces exactly the same appearance.

## Safe by default

The paper fold is off in Classic mode, calm editing, unheld books,
image/raster-based art, missing or invalid interactions and other props
like tables, flowers and toys. There is no persisted project schema,
no new effect assets, no recording dependencies and no altered voices.

## Verification

`src/cinematic-paper-flex.test.ts` covers pickup, handoff and release,
the shared SVG Stage used by exports, repeated sampling and all safety
fallbacks. Check the 30-second workshop visual at 7s, 9.8s and 12s.

The pull request stays a draft until **Foundation/browser QA** and
**complete 20-minute genuine export** checks pass. No automatic merge.
