# PR #97 — Expressive Cheeks & Smile Creases

## Purpose
Little Fixers Club's original vector performers should look more
expressive during story moments without changing their mouths, recorded
dialogue or animation timeline. PR #95 added eyebrow and eyelid motion,
and PR #96 added conservative free-arm reactions. This small pass gives
the existing cartoon cheeks a matching expression.

## What actually changes
- In **Cinematic Storybook** only, a *changed authored emotion keyframe*
  creates an approximately 0.56-second cheek pose.
- Happy and excited: blush ovals lift (up to 1.8 vector units) and warm
  slightly; a brief soft smile crease appears when the authored mouth
  is not open or talking.
- Worried and sad: the cheek blush slightly relaxes and cools;
  surprised stays mostly open-eyed with minimal cheek movement.
- The visual fades back to the original fixed cheek artwork.
- Both desktop preview and genuine WebM export use the same Stage-time
  SVG. A frame re-rendered at the same time has identical geometry.

## Preserved by design
- No mouth path changes; voice-to-mouth/lip-sync, caption and audio
  behavior are untouched.
- **Classic** and calm authoring previews are unchanged.
- Facial sculpting is only for generated vector faces in Cinematic
  Storybook. Artists' painted eyes and image-backed faces are excluded
  from procedural facial acting by the existing safety check.
- No new keys, project schema, saved edits, network generation or
  publication actions. Existing full-body performances and held props
  still use the exact same stored data.

Tests exercise happy/excited, worried/sad, mid-reaction, settled,
classic, calm, authored-mouth preservation, image-backed eyes and
deterministic real Stage rendering. Human merge only after both
Foundation/browser and full 20-minute verified export gates pass.
